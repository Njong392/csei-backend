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

// Get all loan applications (admin only)
router.get("/", requireAuth, verifyRole, loanController.getLoanApplications);

// Get loan application statistics (admin only)
router.get("/stats", requireAuth, verifyRole, loanController.getLoanApplicationStats);

// Get specific loan application (admin only)
router.get("/:applicationId", requireAuth, verifyRole, loanController.getLoanApplication);

// Review loan application (admin only)
router.put("/:applicationId/review", requireAuth, verifyRole, loanController.reviewLoanApplication);

module.exports = router;
