const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const requireAuth = require('../middleware/requireAuth');

// checking if user is authenticated for frontend
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    user: {
      memberId: req.user.memberId,
      role: req.user.role
    }
  });

});

// add a prospect
router.post('/login', memberController.memberLogin)

// get all members
router.get('/', requireAuth, memberController.getMembers)

// get transaction summary for all members
router.get('/transaction-summary',requireAuth, memberController.getMemberTransactionSummary)

// log user out
router.post('/logout', requireAuth, memberController.logout)

// sends a reset password link to the user's email
router.post('/request-password-reset', memberController.requestPasswordReset) 

// reset member password
router.post('/reset-password/:token', memberController.resetMemberPassword)

// get account statement
router.get('/account', requireAuth, memberController.generateAccountStatement)

// get a single member
router.get('/:memberId', requireAuth, memberController.getMember)

// get transaction summary for one member
router.get('/transaction-summary/:memberId', requireAuth, memberController.getMemberTransaction)



module.exports = router