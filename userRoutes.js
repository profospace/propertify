// In your routes file (e.g., routes/userRoutes.js)
const express = require('express');
const router = express.Router();
const userController = require('./userController');

// Middleware for logging incoming requests
router.use((req, res, next) => {
    console.log(`Received ${req.method} request to ${req.originalUrl}`);
    next();
});

// POST request to save user details
router.post('/saveUserDetails', userController.saveUserDetails);

module.exports = router;
