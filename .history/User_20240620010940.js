const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId, // MongoDB ObjectId for the ID field
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    socialId: {
        type: String,
        required: true
    },
    loginType: {
        type: String,
        required: true
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;


