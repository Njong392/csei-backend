const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const requireAuth = require('../middleware/requireAuth');

// add a prospect
router.post('/login', memberController.memberLogin);

// get all members
router.get('/', requireAuth, memberController.getMembers)

// log user out
router.post('/logout', requireAuth, memberController.logout);

module.exports = router