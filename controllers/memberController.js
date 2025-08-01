const sql = require('mssql')
const checkRequiredFields = require('../utils/missingFields')
const config = require('../config/tableConfig')
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const transporter = require('../utils/nodemailerTransporter')
const PDFDocument = require('pdfkit')
const generatePDFContent = require('../utils/generatePDFContent')


// member log in
exports.memberLogin = async(req, res) => {
    const { memberId, password } = req.body;
  const requiredFields = config.loginRequiredFields;

  // Validate required fields
  const missingFields = checkRequiredFields(req.body, requiredFields);
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  try{
    const request = new sql.Request()
    request.input('memberId', sql.VarChar(50), memberId);
    const result = await request.query('SELECT * FROM Members WHERE member_id = @memberId')

    if(result.recordset.length === 0){
        return res.status(404).json({error: 'No such member found'})
    }

    const member = result.recordset[0]

    // Compare password with hashed password
    const passwordMatch = await bcrypt.compare(password, member.password)

    if(!passwordMatch){
        return res.status(401).json({error: 'Invalid password'})
    }

    // Create a JWT token for session
    const token = jwt.sign(
      { memberId: member.member_id, role: member.role }, 
      process.env.SECRET_ACCESS_TOKEN, 
      {expiresIn: '1h'}
    )

    // Set token in response header
    res.cookie('sessionToken', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      maxAge: 3600000 
    })

    res.status(200).json({message: 'Login succesful'})

  } catch (err){
    res.status(500).json({error: err.message})
  }
}

// log out member
exports.logout = (req, res) => {
  res.clearCookie('sessionToken', {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax'
  })
  res.status(200).json({message: 'Logged out successfully'})
}

// Send password reset link to member's email
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email address is required." });
  }

  try {
    // Check if the email exists in the Members table
    const request = new sql.Request();
    request.input("email", sql.VarChar, email);
    const userResult = await request.query(
      "SELECT * FROM Members WHERE email = @email"
    );

    if (userResult.recordset.length === 0) {
      return res
        .status(200)
        .json({
          message:
            "If your email is registered, you will receive a password reset link.",
        });
    }

    // if user is found, generate a reset token and save it to the database
    const user = userResult.recordset[0];
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);


    const updateRequest = new sql.Request();
    updateRequest.input("memberId", sql.VarChar, user.member_id);
    updateRequest.input("token", sql.VarChar, hashedResetToken);
    updateRequest.input("expires", sql.DateTime, passwordResetExpires);
    await updateRequest.query(
      "UPDATE Members SET password_reset_token = @token, password_reset_expires = @expires WHERE member_id = @memberId"
    );

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

   // Send the reset link via email
    const mailOptions = {
      from: '"CSEI" <your@email.com>',
      to: user.email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message:
        "If your email is registered, you will receive a password reset link.",
    });
  } catch (error) {
    console.error("Error in requestPasswordReset:", error);
    res.status(500).json({ error: "An internal error occurred." });
  }
};


exports.resetMemberPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: "A new password is required." });
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();

    const request = new sql.Request();
    request.input("hashedToken", sql.VarChar, hashedToken);
    request.input("now", sql.DateTime, now);

    const userResult = await request.query(
      "SELECT * FROM Members WHERE password_reset_token = @hashedToken AND password_reset_expires > @now"
    );

    if (userResult.recordset.length === 0) {
      return res
        .status(400)
        .json({ error: "Password reset token is invalid or has expired." });
    }

    const user = userResult.recordset[0];

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateRequest = new sql.Request();
    updateRequest.input("memberId", sql.VarChar, user.member_id);
    updateRequest.input("hashedPassword", sql.VarChar, hashedPassword);
    await updateRequest.query(
      "UPDATE Members SET password = @hashedPassword, password_reset_token = NULL, password_reset_expires = NULL WHERE member_id = @memberId"
    );

    res
      .status(200)
      .json({ message: "Password has been updated successfully." });
  } catch (error) {
    console.error("Error in resetPasswordWithToken:", error);
    res.status(500).json({ error: "An internal error occurred." });
  }
};

// Get all members
exports.getMembers = async(req, res) => {
  try{
    const request = new sql.Request()

    const membersResult = await request.query('SELECT * FROM Members')
    const members = membersResult.recordset

    // For each member, get balance
    const membersBalance = await Promise.all(
      members.map(async (member) => {
        const balanceRequest = new sql.Request()
        balanceRequest.input("member_id", sql.VarChar(50), member.member_id)
        const balanceResult = await balanceRequest.query(
          "SELECT csei_database.dbo.CustomerBalance(@member_id) AS balance"
        )
        return {
          ...member,
          balance: balanceResult.recordset[0].balance
        }
      })
    )

    res.status(200).json(membersBalance)
  } catch(err){
    res.status(500).json({error: err.message})
  }
}

// Get a specific member by ID
exports.getMember = async(req, res) => {
  const { memberId } = req.params

  try{
    const request = new sql.Request()
    request.input('member_id', sql.VarChar(50), memberId)

    // Fetch member info
    const result = await request.query('SELECT * FROM Members WHERE member_id = @member_id')
    if(result.recordset.length === 0){
      return res.status(404).json({error: 'Member not found'})
    }
    const member = result.recordset[0]

    // Fetch member balance
    const balanceRequest = await request.query("SELECT csei_database.dbo.CustomerBalance(@member_id) AS balance")
    const balance = balanceRequest.recordset[0].balance

    res.status(200).json({...member, balance})
    
  } catch(err){
    res.status(500).json({error: err.message})
  }
}

// Get all members and their transactions
exports.getMemberTransactionSummary = async(req, res) => {
  try{
    const request = new sql.Request()

    // query member transaction view
    const result = await request.query('SELECT * FROM MemberTransactionSummary ORDER BY [Posting Date] DESC')

    // use a map to group transactions by member
    const memberMap = new Map()

    for(const row of result.recordset){
      const { 
        member_id, 
        member_name,
        "Document No_": documentNo, 
        "Description": description, 
        "Original Amount": originalAmount, 
        "Open Amount": openAmount, 
        "External Document No_": externalDocumentNo,
        "Posting Date": postingDate
      } = row

      // if member is not in the map, add it
      if(!memberMap.has(member_id)){
        memberMap.set(member_id, {
          member_id,
          member_name,
          transactions: []
        })
      }

      // if a transaction exists, add it to the member's transactions
      if(documentNo){
        memberMap.get(member_id).transactions.push({
          documentNo,
          description,
          originalAmount,
          openAmount,
          externalDocumentNo,
          postingDate
        })
      } else{
        memberMap.get(member_id).transactions = "No transactions for this member"
      }
    }

    const summary = Array.from(memberMap.values())

    res.status(200).json(summary)
  } catch(err){
    res.status(500).json({error: err.message})
  }
}

// get specific member transaction
exports.getMemberTransaction = async (req, res) => {
  const { memberId } = req.params
  try{
    const request = new sql.Request()
    request.input("member_id", sql.VarChar(50), memberId)
    const result = await request.query("SELECT * FROM MemberTransactionSummary WHERE member_id = @member_id ORDER BY [Posting Date] DESC")

    if(result.recordset.length === 0){
      return res.status(404).json({error: "No transaction record for this member"})
    }

    res.status(200).json(result.recordset)

  } catch{
    res.status(500).json({error: "Some error occurred while retrieving this member"})
  }
}


exports.generateAccountStatement = async (req, res) => {
  const { memberId } = req.user; // From JWT token
  const { startDate, endDate } = req.query; // Optional date range

  try {
    // Get member details
    let request = new sql.Request();
    request.input("member_id", sql.VarChar(10), memberId);

    const memberResult = await request.query(`
          SELECT 
              member_id, member_name, email, first_telephone_line,
              first_address_line, second_address_line, city, country,
              role
          FROM Members 
          WHERE member_id = @member_id
      `);

    if (memberResult.recordset.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const member = memberResult.recordset[0];

    // Get member balance
    const balanceRequest = new sql.Request();
    balanceRequest.input("member_id", sql.VarChar(10), memberId);
    const balanceResult = await balanceRequest.query(
      "SELECT csei_database.dbo.CustomerBalance(@member_id) AS balance"
    );
    const currentBalance = balanceResult.recordset[0].balance || 0;

    // Get transaction history
    request = new sql.Request();
    request.input("member_id", sql.VarChar(10), memberId);

    let transactionQuery = `
          SELECT 
              [Document No_] as documentNo,
              [Description] as description,
              [Original Amount] as originalAmount,
              [Open Amount] as openAmount,
              [External Document No_] as externalDocumentNo,
              [Posting Date] as postingDate
          FROM MemberTransactionSummary 
          WHERE member_id = @member_id
      `;

    // Add date filter if provided
    if (startDate && endDate) {
      transactionQuery += ` AND [Posting Date] BETWEEN '${startDate}' AND '${endDate}'`;
    }

    transactionQuery += ` ORDER BY [Posting Date] DESC`;

    const transactionResult = await request.query(transactionQuery);
    const transactions = transactionResult.recordset;

    // Calculate summary statistics
    const totalDeposits = transactions
      .filter((t) => t.originalAmount > 0)
      .reduce((sum, t) => sum + parseFloat(t.originalAmount || 0), 0);

    const totalWithdrawals = transactions
      .filter((t) => t.originalAmount < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.originalAmount || 0)), 0);

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    // Set response headers for PDF download
    const filename = `account-statement-${memberId}-${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Generate PDF content
    generatePDFContent(
      doc,
      member,
      currentBalance,
      transactions,
      totalDeposits,
      totalWithdrawals,
      startDate,
      endDate
    );

    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error("Error generating account statement:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate account statement" });
    }
  }
};
