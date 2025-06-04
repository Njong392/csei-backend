const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');

// add a prospect
router.post('/', memberController.addProspect);

module.exports = router