// User profile schema with extended functionality
const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  propertyTypes: [{
    type: String,
    enum: ['Apartment', 'House', 'Villa', 'Plot', 'Commercial', 'Shop', 'Warehouse']
  }],
  priceRange: {
    min: Number,
    max: Number
  },
  preferredLocations: [{
    name: String,
    coordinates: {
      type: { type: String, default: 'Point' },
      coordinates: [Number] // [longitude, latitude]
    }
  }],
  amenities: [String],
  propertySize: {
    min: Number,
    max: Number,
    unit: { type: String, default: 'sq.ft' }
  }
});

const notificationSettingsSchema = new mongoose.Schema({
  priceAlerts: { type: Boolean, default: true },
  newProperties: { type: Boolean, default: true },
  savedSearchAlerts: { type: Boolean, default: true },
  emailNotifications: { type: Boolean, default: true },
  pushNotifications: { type: Boolean, default: true },
  smsNotifications: { type: Boolean, default: false }
});

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  personalInfo: {
    name: String,
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: String,
    avatar: String,
    dateOfBirth: Date,
    gender: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      pincode: String
    }
  },
  preferences: userPreferencesSchema,
  notificationSettings: notificationSettingsSchema,
  searchHistory: [{
    query: String,
    filters: Object,
    timestamp: { type: Date, default: Date.now },
    resultCount: Number
  }],
  savedProperties: [{
    propertyId: String,
    savedAt: { type: Date, default: Date.now },
    notes: String
  }],
  savedSearches: [{
    query: String,
    filters: Object,
    createdAt: { type: Date, default: Date.now },
    lastNotified: Date
  }],
  recentlyViewed: [{
    propertyId: String,
    viewedAt: { type: Date, default: Date.now }
  }],
  contactedProperties: [{
    propertyId: String,
    contactedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['Pending', 'Viewed', 'Scheduled', 'Visited', 'Negotiating', 'Closed']
    },
    notes: String
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
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for better query performance
userProfileSchema.index({ userId: 1 });
userProfileSchema.index({ 'personalInfo.email': 1 });
userProfileSchema.index({ 'personalInfo.phone': 1 });
userProfileSchema.index({ 'savedProperties.propertyId': 1 });
userProfileSchema.index({ 'recentlyViewed.viewedAt': -1 });
userProfileSchema.index({ 'searchHistory.timestamp': -1 });

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = UserProfile;