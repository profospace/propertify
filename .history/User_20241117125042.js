const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    required: true,
    unique: true
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
  profile: {
    avatar: String,
    address: String,
    preferences: {
      propertyTypes: [String],
      priceRange: {
        min: Number,
        max: Number
      },
      preferredLocations: [String]
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      priceAlerts: {
        type: Boolean,
        default: false
      }
    }
  },
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
      contactMethod: String
    }]
  },
  savedSearches: [{
    name: String,
    criteria: Object,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Method to generate JWT token
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

const User = mongoose.model('User', userSchema);