const express = require("express");
const router = express.Router();
const loanController = require("../controllers/loanApplicationController");
const requireAuth = require("../middleware/requireAuth");
const verifyRole = require("../middleware/verifyRole");
const { uploadSingle } = require("../utils/s3Uploads");


// Submit loan application
router.post("/", requireAuth, loanController.submitLoanApplication);

// Get member's own loan applications
router.get("/my-applications", requireAuth, loanController.getMemberLoanApplications);


// Upload engagement letter endpoint
router.post("/upload-engagement-letter", (req, res) => {
  console.log("Upload request received"); // Debug log

  uploadSingle(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err); // Debug log

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

    console.log("Upload successful:", req.file); // Debug log

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
});

router.get("/file/:applicationId", async (req, res) => {
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
});

// Get all loan applications (admin only)
router.get("/", requireAuth, verifyRole, loanController.getLoanApplications);

// Get loan application statistics (admin only)
router.get("/stats", requireAuth, verifyRole, loanController.getLoanApplicationStats);

// Get specific loan application (admin only)
router.get("/:applicationId", requireAuth, verifyRole, loanController.getLoanApplication);

// Review loan application (admin only)
router.put("/:applicationId/review", requireAuth, verifyRole, loanController.reviewLoanApplication);

module.exports = router;
