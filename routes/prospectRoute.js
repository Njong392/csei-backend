const express = require('express');
const router = express.Router();
const prospectController = require('../controllers/prospectController');

// get prospects
router.get('/', prospectController.getProspects)

// add a prospect
router.post('/', prospectController.addProspect)

// get a prospect by id
router.get('/:id', prospectController.getProspect)

// update prospect status
router.patch('/:id', prospectController.updateProspectStatus)

module.exports = router