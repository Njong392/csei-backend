const express = require('express');
const router = express.Router();
const prospectController = require('../controllers/prospectController');
const verifyRole = require('../middleware/verifyRole');
const requireAuth = require('../middleware/requireAuth');

// get prospects
router.get('/', requireAuth, verifyRole, prospectController.getProspects)

// add a prospect
router.post('/', prospectController.addProspect)

// get a prospect by id
router.get('/:id', requireAuth, verifyRole, prospectController.getProspect)

// update prospect status
router.patch('/:id', requireAuth, verifyRole, prospectController.updateProspectStatus)

module.exports = router