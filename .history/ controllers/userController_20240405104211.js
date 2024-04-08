// In your controller file (e.g., controllers/userController.js)
const User = require('./models/User'); // Assuming you have a User model

// Controller function to save user details
const saveUserDetails = async (req, res) => {
    try {
        // Extract user details from request body
        const { name, email, socialId, loginType } = req.body;

        // Create a new user object
        const newUser = new User({
            name,
            email,
            socialId,
            loginType
        });

        // Save the user details to the database
        await newUser.save();

        // Respond with success message
        res.status(200).json({ success: true, message: 'User details saved successfully' });
    } catch (error) {
        console.error('Error saving user details:', error);
        // Respond with error message
        res.status(500).json({ success: false, message: 'Failed to save user details' });
    }
};

module.exports = {
    saveUserDetails
};
