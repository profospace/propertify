const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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


