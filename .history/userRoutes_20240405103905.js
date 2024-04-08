// In your routes file (e.g., routes/userRoutes.js)
const express = require('express');
const router = express.Router();
const userController = require('.controllers/userController');

const { saveUserDetails } = require('./ controllers/userController');


// POST request to save user details
router.post('/saveUserDetails', userController.saveUserDetails);

module.exports = router;
