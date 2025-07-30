const sql = require("mssql");
const checkRequiredFields = require("../utils/missingFields");
const config = require("../config/tableConfig");
const transporter = require("../utils/nodemailerTransporter");
const { generatePresignedUrl } = require("../utils/s3Uploads");
const { uploadSingle } = require("../utils/s3Uploads");

// Get all loan applications (admin only)
exports.getLoanApplications = async (req, res) => {
  try {
    const request = new sql.Request();

    // Join with Members table to get applicant details
    const result = await request.query(`
            SELECT 
                la.*,
                m.member_name as applicant_name,
                m.email as applicant_email,
                m.first_telephone_line as applicant_phone
            FROM LoanApplications la
            JOIN Members m ON la.applicant_id = m.member_id
            ORDER BY la.submitted_at DESC
        `);

    res.status(200).json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get specific loan application
exports.getLoanApplication = async (req, res) => {
  const { applicationId } = req.params;

  try {
    const request = new sql.Request();
    request.input("application_id", sql.VarChar(50), applicationId);

    // Get loan application with applicant and guarantor details
    const result = await request.query(`
            SELECT 
                la.*,
                m.member_name as applicant_name,
                m.email as applicant_email,
                m.first_telephone_line as applicant_phone,
                lg.guarantor_id,
                gm.member_name as guarantor_name,
                gm.email as guarantor_email,
                lg.committed_amount
            FROM LoanApplications la
            JOIN Members m ON la.applicant_id = m.member_id
            LEFT JOIN LoanGuarantors lg ON la.loan_application_id = lg.loan_application_id
            LEFT JOIN Members gm ON lg.guarantor_id = gm.member_id
            WHERE la.loan_application_id = @application_id
        `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Loan application not found" });
    }

    // Structure the response to handle multiple guarantors
    const application = result.recordset[0];
    const guarantors = result.recordset
      .filter((row) => row.guarantor_id)
      .map((row) => ({
        guarantor_id: row.guarantor_id,
        guarantor_name: row.guarantor_name,
        guarantor_email: row.guarantor_email,
        committed_amount: row.committed_amount,
      }));

    // Remove guarantor fields from main application object
    delete application.guarantor_id;
    delete application.guarantor_name;
    delete application.guarantor_email;
    delete application.committed_amount;

    // Generate presigned URL for engagement letter if it exists
    if (application.engagement_letter) {
      try {
        // Extract S3 key from the stored URL or use the key directly
        let s3Key = application.engagement_letter;

        // If it's a full S3 URL, extract just the key part
        if (s3Key.includes("amazonaws.com/")) {
          s3Key = s3Key.split("amazonaws.com/")[1];
        } else if (s3Key.includes("s3.")) {
          // Handle different S3 URL formats
          const urlParts = s3Key.split("/");
          s3Key = urlParts
            .slice(urlParts.indexOf(process.env.S3_BUCKET_NAME) + 1)
            .join("/");
        }

        // Generate presigned URL (valid for 1 hour)
        application.engagement_letter_url = await generatePresignedUrl(
          s3Key,
          3600
        );

        console.log("Generated presigned URL for:", s3Key);
      } catch (error) {
        console.error("Error generating presigned URL:", error);
        // Keep original URL if presigned URL generation fails
        application.engagement_letter_url = application.engagement_letter;
      }
    }

    res.status(200).json({
      ...application,
      guarantors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Submit loan application (member only)
exports.submitLoanApplication = async (req, res) => {
  const { memberId } = req.user; // From JWT token
  const requiredFields = config.loanApplicationRequiredFields;

  // Validate required fields
  const missingFields = checkRequiredFields(req.body, requiredFields);
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const { amount, duration, engagement_letter, guarantors = [] } = req.body;

  try {
    // Check if member exists and get member details
    let request = new sql.Request();
    request.input("member_id", sql.VarChar(10), memberId);
    const memberResult = await request.query(
      "SELECT * FROM Members WHERE member_id = @member_id"
    );

    if (memberResult.recordset.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const member = memberResult.recordset[0];

    // Check if member has any pending applications
    request = new sql.Request();
    request.input("member_id", sql.VarChar(10), memberId);
    const pendingCheck = await request.query(`
            SELECT * FROM LoanApplications 
            WHERE applicant_id = @member_id AND status IN ('pending', 'under_review')
        `);

    if (pendingCheck.recordset.length > 0) {
      return res.status(400).json({
        error:
          "You already have a pending loan application. Please wait for it to be processed.",
      });
    }

    // Generate unique application ID
    const applicationId = "LA" + Date.now().toString().slice(-8);

    // Insert loan application
    request = new sql.Request();
    request.input("loan_application_id", sql.VarChar(50), applicationId);
    request.input("applicant_id", sql.VarChar(10), memberId);
    request.input("amount", sql.Decimal(18, 2), amount);
    request.input("duration", sql.Int, duration);
    request.input("engagement_letter", sql.VarChar(255), engagement_letter);
    request.input("status", sql.VarChar(20), "pending");
    request.input("submitted_at", sql.DateTime, new Date());

    await request.query(`
            INSERT INTO LoanApplications (
                loan_application_id, applicant_id, amount, duration, 
                engagement_letter, status, submitted_at
            ) VALUES (
                @loan_application_id, @applicant_id, @amount, @duration,
                @engagement_letter, @status, @submitted_at
            )
        `);

    // Insert guarantors if provided
    if (guarantors.length > 0) {
      for (const guarantor of guarantors) {
        // Validate guarantor exists and is a member
        request = new sql.Request();
        request.input("guarantor_id", sql.VarChar(10), guarantor.guarantor_id);
        const guarantorCheck = await request.query(
          "SELECT * FROM Members WHERE member_id = @guarantor_id"
        );

        if (guarantorCheck.recordset.length === 0) {
          return res.status(400).json({
            error: `Guarantor ${guarantor.guarantor_id} is not a valid member`,
          });
        }

        // Insert guarantor
        request = new sql.Request();
        request.input("loan_application_id", sql.VarChar(50), applicationId);
        request.input("guarantor_id", sql.VarChar(10), guarantor.guarantor_id);
        request.input(
          "committed_amount",
          sql.Decimal(18, 2),
          guarantor.committed_amount
        );

        await request.query(`
                    INSERT INTO LoanGuarantors (loan_application_id, guarantor_id, committed_amount)
                    VALUES (@loan_application_id, @guarantor_id, @committed_amount)
                `);
      }
    }

    // Send confirmation email to applicant
    const mailOptions = {
      from: '"CSEI Loan Department" <loans@csei.com>',
      to: member.email,
      subject: "Loan Application Submitted Successfully",
      html: `
                <h2>Loan Application Confirmation</h2>
                <p>Dear ${member.member_name},</p>
                <p>Your loan application has been submitted successfully.</p>
                <h3>Application Details:</h3>
                <ul>
                    <li><strong>Application ID:</strong> ${applicationId}</li>
                    <li><strong>Amount:</strong> ${amount.toLocaleString()} FCFA</li>
                    <li><strong>Duration:</strong> ${duration} months</li>
                    <li><strong>Status:</strong> Pending Review</li>
                </ul>
                <p>You will be notified once your application has been reviewed.</p>
                <p>Thank you for choosing CSEI.</p>
            `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: "Loan application submitted successfully",
      applicationId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get member's loan applications
exports.getMemberLoanApplications = async (req, res) => {
  const { memberId } = req.user; // From JWT token

  try {
    const request = new sql.Request();
    request.input("member_id", sql.VarChar(10), memberId);

    const result = await request.query(`
            SELECT * FROM LoanApplications 
            WHERE applicant_id = @member_id 
            ORDER BY submitted_at DESC
        `);

    // Generate presigned URLs for engagement letters
    const applicationsWithUrls = await Promise.all(
      result.recordset.map(async (app) => {
        if (app.engagement_letter) {
          try {
            let s3Key = app.engagement_letter;

            // Extract key from full URL if needed
            if (s3Key.includes("amazonaws.com/")) {
              s3Key = s3Key.split("amazonaws.com/")[1];
            }

            app.engagement_letter_url = await generatePresignedUrl(s3Key, 3600);
          } catch (error) {
            console.error(
              "Error generating presigned URL for app:",
              app.loan_application_id,
              error
            );
            app.engagement_letter_url = app.engagement_letter;
          }
        }
        return app;
      })
    );

    res.status(200).json(applicationsWithUrls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Review loan application (admin only)
exports.reviewLoanApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { status, comments } = req.body;
  const { memberId: reviewerId } = req.user; // Admin ID from JWT

  const validStatuses = [
    "approved",
    "rejected",
    "under_review",
    "requires_more_info",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  try {
    // Get application details
    let request = new sql.Request();
    request.input("application_id", sql.VarChar(50), applicationId);
    const appResult = await request.query(`
            SELECT la.*, m.member_name as applicant_name, m.email as applicant_email
            FROM LoanApplications la
            JOIN Members m ON la.applicant_id = m.member_id
            WHERE la.loan_application_id = @application_id
        `);

    if (appResult.recordset.length === 0) {
      return res.status(404).json({ error: "Loan application not found" });
    }

    const application = appResult.recordset[0];

    // Update application status
    request = new sql.Request();
    request.input("application_id", sql.VarChar(50), applicationId);
    request.input("status", sql.VarChar(20), status);
    request.input("reviewed_at", sql.DateTime, new Date());

    await request.query(`
            UPDATE LoanApplications 
            SET status = @status, reviewed_at = @reviewed_at
            WHERE loan_application_id = @application_id
        `);

    // Insert review record
    if (comments) {
      request = new sql.Request();
      request.input("application_id", sql.VarChar(50), applicationId);
      request.input("reviewer_id", sql.VarChar(10), reviewerId);
      request.input("status", sql.VarChar(20), status);
      request.input("comments", sql.VarChar(500), comments);
      request.input("reviewed_at", sql.DateTime, new Date());

      await request.query(`
                INSERT INTO LoanReviews (
                    loan_application_id, reviewer_id, status, comments, reviewed_at
                ) VALUES (
                    @application_id, @reviewer_id, @status, @comments, @reviewed_at
                )
            `);
    }

    // Send email notification to applicant
    let emailSubject = "Loan Application Status Update";
    let emailContent = `
            <h2>Loan Application Status Update</h2>
            <p>Dear ${application.applicant_name},</p>
            <p>Your loan application <strong>${applicationId}</strong> has been reviewed.</p>
            <p><strong>New Status:</strong> ${status
              .replace("_", " ")
              .toUpperCase()}</p>
        `;

    if (comments) {
      emailContent += `<p><strong>Comments:</strong> ${comments}</p>`;
    }

    if (status === "approved") {
      emailContent += `
                <p>🎉 Congratulations! Your loan application has been approved.</p>
                <p>Our team will contact you shortly to complete the loan disbursement process.</p>
            `;
    } else if (status === "rejected") {
      emailContent += `
                <p>Unfortunately, your loan application has been rejected.</p>
                <p>You may reapply after addressing the concerns mentioned in the comments.</p>
            `;
    } else if (status === "requires_more_info") {
      emailContent += `
                <p>We need additional information to process your application.</p>
                <p>Please contact our loan department or submit the required documents.</p>
            `;
    }

    emailContent += `
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Thank you for choosing CSEI.</p>
        `;

    const mailOptions = {
      from: '"CSEI Loan Department" <loans@csei.com>',
      to: application.applicant_email,
      subject: emailSubject,
      html: emailContent,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Loan application review completed",
      status,
      notificationSent: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get loan application statistics (admin only)
exports.getLoanApplicationStats = async (req, res) => {
  try {
    const request = new sql.Request();

    const result = await request.query(`
            SELECT 
                COUNT(*) as total_applications,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'requires_more_info' THEN 1 ELSE 0 END) as requires_more_info,
                SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_approved_amount,
                AVG(CASE WHEN status = 'approved' THEN amount ELSE NULL END) as avg_approved_amount
            FROM LoanApplications
        `);

    res.status(200).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Upload engagement letter endpoint
exports.uploadEngagementLetter = (req, res) => {
  console.log("Upload request received");

  uploadSingle(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);

      // Handle different types of errors
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "File too large. Maximum size is 10MB.",
        });
      }

      if (err.message && err.message.includes("Invalid file type")) {
        return res.status(400).json({
          error:
            "Invalid file type. Only PDF, DOC, and DOCX files are allowed.",
        });
      }

      if (err.code === "NoSuchBucket") {
        return res.status(500).json({
          error: "Storage configuration error. Please contact support.",
        });
      }

      return res.status(400).json({
        error: err.message || "File upload failed",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    console.log("Upload successful:", req.file);

    // Return the S3 file information
    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: req.file.location,
      fileKey: req.file.key,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
};

// Download/view engagement letter for a loan application
exports.getEngagementLetterFile = async (req, res) => {
  const { applicationId } = req.params;

  try {
    // Get the application to find the engagement letter key
    const request = new sql.Request();
    request.input("application_id", sql.VarChar(50), applicationId);

    const result = await request.query(`
          SELECT engagement_letter, applicant_id 
          FROM LoanApplications 
          WHERE loan_application_id = @application_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    const application = result.recordset[0];

    // Check if user has permission to access this file
    const isOwner = req.user.memberId === application.applicant_id;
    const isAdmin = req.user.role?.trim() === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!application.engagement_letter) {
      return res.status(404).json({ error: "No engagement letter found" });
    }

    // Extract S3 key
    let s3Key = application.engagement_letter;
    if (s3Key.includes("amazonaws.com/")) {
      s3Key = s3Key.split("amazonaws.com/")[1];
    }

    // Generate presigned URL (valid for 5 minutes for security)
    const presignedUrl = await generatePresignedUrl(s3Key, 300);

    res.status(200).json({
      fileUrl: presignedUrl,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    console.error("Error generating file access URL:", error);
    res.status(500).json({ error: "Failed to generate file access URL" });
  }
};