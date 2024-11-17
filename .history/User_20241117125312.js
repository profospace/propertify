// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // Existing core fields - UNCHANGED
    name: String,
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        unique: true,
        sparse: true
    },
    socialId: String,
    loginType: {
        type: String,
        enum: ['EMAIL', 'GOOGLE', 'FACEBOOK', 'APPLE', 'PHONE'],
        required: true
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },

    // Enhanced profile section - maintains existing structure with additions
    profile: {
        avatar: String,
        address: String,
        // Extended address details (optional)
        addressDetails: {
            street: String,
            city: String,
            state: String,
            country: String,
            pincode: String
        },
        // Existing preferences structure
        preferences: {
            propertyTypes: [String],
            priceRange: {
                min: Number,
                max: Number
            },
            preferredLocations: [String],
            // Additional preference fields (optional)
            amenities: [String],
            propertySize: {
                min: Number,
                max: Number,
                unit: { type: String, default: 'sq.ft' }
            }
        },
        // Existing notifications structure
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            priceAlerts: { type: Boolean, default: false },
            // Additional notification options (optional)
            savedSearchAlerts: { type: Boolean, default: true },
            smsNotifications: { type: Boolean, default: false }
        },
        // Additional profile fields (optional)
        dateOfBirth: Date,
        gender: String
    },

    // Existing history structure with enhancements
    history: {
        viewedProperties: [{
            propertyId: String,
            timestamp: { type: Date, default: Date.now },
            timeSpent: Number
        }],
        likedProperties: [{
            propertyId: String,
            timestamp: { type: Date, default: Date.now }
        }],
        contactedProperties: [{
            propertyId: String,
            timestamp: { type: Date, default: Date.now },
            contactMethod: String,
            // Additional tracking (optional)
            status: {
                type: String,
                enum: ['Pending', 'Viewed', 'Scheduled', 'Visited', 'Negotiating', 'Closed']
            },
            notes: String
        }],
        // Additional history tracking (optional)
        searchHistory: [{
            query: String,
            filters: Object,
            timestamp: { type: Date, default: Date.now },
            resultCount: Number
        }]
    },

    // Existing saved searches with enhancements
    savedSearches: [{
        name: String,
        criteria: Object,
        timestamp: { type: Date, default: Date.now },
        // Additional fields (optional)
        lastNotified: Date,
        notifyOnNew: { type: Boolean, default: false }
    }],

    // New sections (all optional)
    emiCalculations: [{
        propertyId: String,
        calculatedAt: { type: Date, default: Date.now },
        loanAmount: Number,
        interestRate: Number,
        tenure: Number,
        monthlyEMI: Number
    }],

    verificationStatus: {
        email: { type: Boolean, default: false },
        phone: { type: Boolean, default: false },
        government: { type: Boolean, default: false },
        documents: [{
            type: String,
            verified: Boolean,
            uploadedAt: Date,
            verifiedAt: Date
        }]
    },

    activityLog: [{
        action: String,
        timestamp: { type: Date, default: Date.now },
        details: Object
    }]
}, {
    timestamps: true
});

// Existing JWT token generation - UNCHANGED
userSchema.methods.generateAuthToken = function() {
    return jwt.sign(
        { 
            id: this._id,
            email: this.email,
            loginType: this.loginType
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ socialId: 1 });
userSchema.index({ 'history.viewedProperties.timestamp': -1 });
userSchema.index({ 'history.likedProperties.timestamp': -1 });
userSchema.index({ 'savedSearches.timestamp': -1 });
userSchema.index({ 'activityLog.timestamp': -1 });

const User = mongoose.model('User', userSchema);

module.exports = User;