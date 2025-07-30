const express = require("express");
const router = express.Router();
const loanController = require("../controllers/loanApplicationController");
const notificationController = require("../controllers/notificationController");
const requireAuth = require("../middleware/requireAuth");
const verifyRole = require("../middleware/verifyRole");


// Submit loan application
router.post("/", requireAuth, loanController.submitLoanApplication);

// Get member's own loan applications
router.get("/my-applications", requireAuth, loanController.getMemberLoanApplications);

// Upload engagement letter endpoint
router.post("/upload-engagement-letter", loanController.uploadEngagementLetter);

router.get("/file/:applicationId", loanController.getEngagementLetterFile);

// check for balance changes and send notifications
//router.post("/check-balance-changes", requireAuth, verifyRole, notificationController.checkAndNotifyBalanceChanges)

// Get all loan applications (admin only)
router.get("/", requireAuth, verifyRole, loanController.getLoanApplications);

// Get loan application statistics (admin only)
router.get("/stats", requireAuth, verifyRole, loanController.getLoanApplicationStats);

// Get specific loan application (admin only)
router.get("/:applicationId", requireAuth, verifyRole, loanController.getLoanApplication);

// Review loan application (admin only)
router.put("/:applicationId/review", requireAuth, verifyRole, loanController.reviewLoanApplication);

module.exports = router;
