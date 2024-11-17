const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Define all sub-schemas first
const contactHistorySchema = new mongoose.Schema({
    propertyId: {
        type: String,
        required: true
    },
    ownerPhone: String,
    contactType: {
        type: String,
        enum: ['CALL', 'WHATSAPP', 'CHAT'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['INITIATED', 'CONNECTED', 'FAILED', 'NO_RESPONSE', 'Pending', 'Viewed', 'Scheduled', 'Visited', 'Negotiating', 'Closed'],
        default: 'INITIATED'
    },
    duration: Number,
    notes: String
});

const searchHistorySchema = new mongoose.Schema({
    query: String,
    filters: Object,
    resultCount: Number,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const viewHistorySchema = new mongoose.Schema({
    propertyId: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    timeSpent: Number
});

const savedPropertySchema = new mongoose.Schema({
    propertyId: {
        type: String,
        required: true
    },
    savedAt: {
        type: Date,
        default: Date.now
    }
});

const addressDetailsSchema = new mongoose.Schema({
    street: String,
    city: String,
    state: String,
    country: String,
    pincode: String
}, { _id: false });

const preferencesSchema = new mongoose.Schema({
    propertyTypes: [String],
    priceRange: {
        min: Number,
        max: Number
    },
    preferredLocations: [String],
    amenities: [String],
    propertySize: {
        min: Number,
        max: Number,
        unit: { type: String, default: 'sq.ft' }
    }
}, { _id: false });

const notificationsSchema = new mongoose.Schema({
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    priceAlerts: { type: Boolean, default: false },
    savedSearchAlerts: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false }
}, { _id: false });

// Main User Schema
const userSchema = new mongoose.Schema({
    // Core fields (maintained from both versions)
    name: String,
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        unique: true,
        required: true
    },
    socialId: String,
    loginType: {
        type: String,
        enum: ['EMAIL', 'GOOGLE', 'FACEBOOK', 'APPLE', 'PHONE'],
        required: true,
        default: 'PHONE'
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: Date,

    // Enhanced profile section
    profile: {
        avatar: String,
        address: String,
        addressDetails: addressDetailsSchema,
        preferences: preferencesSchema,
        notifications: notificationsSchema,
        dateOfBirth: Date,
        gender: String
    },

    // History tracking (merged from both versions)
    history: {
        viewedProperties: [viewHistorySchema],
        likedProperties: [savedPropertySchema],
        contactedProperties: [contactHistorySchema],
        searchHistory: [searchHistorySchema]
    },

    // Additional features (optional)
    savedProperties: [savedPropertySchema],
    savedSearches: [{
        name: String,
        criteria: Object,
        timestamp: { type: Date, default: Date.now },
        lastNotified: Date,
        notifyOnNew: { type: Boolean, default: false }
    }],

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

// Token generation method (maintained)
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

// Indexes (combined from both versions)
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });
userSchema.index({ socialId: 1 });
userSchema.index({ 'savedProperties.propertyId': 1 });
userSchema.index({ 'history.viewedProperties.timestamp': -1 });
userSchema.index({ 'history.likedProperties.timestamp': -1 });
userSchema.index({ 'history.searchHistory.timestamp': -1 });
userSchema.index({ 'history.contactedProperties.timestamp': -1 });
userSchema.index({ 'savedSearches.timestamp': -1 });
userSchema.index({ 'activityLog.timestamp': -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;