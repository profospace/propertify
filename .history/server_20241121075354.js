const express = require('express');
const properties = require('./data'); // Import the properties data
require('dotenv').config();
const amplitude = require('@amplitude/analytics-node');
const axios = require('axios');
bodyParser = require('body-parser');
const uuid = require('uuid'); // Import the uuid library
const AWS = require('aws-sdk');
const multer = require('multer');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Import the cors middleware
const PORT = process.env.PORT || 5053;
const mongoose = require('mongoose');
const Property = require('./models/Property'); // Make sure this path is correct
const User = require('./User'); // Import the User model
const Building = require('./Building'); // Import the User model
const Category = require('./Category')
const Project = require('./project'); // Add this line with your other imports
const projects = require('./project')
const Builder = require('./Builder')
const constantData = require('./ConstantModel');
const ColorGradient = require('./dynamicdata');
const OTP_URL = 'https://www.fast2sms.com/dev/bulkV2';
const API_KEY = 'K6vUoBQk7gSJhVlp1tMnrPYuf2I4zeAN5FTGsHj3Z8ic9LWbDEGFPfTkcAzNQedrq6JR2mUg9h3vbV4Y';
const ListOptions = require('./ListOptions');
const { authenticateToken } = require('./middleware/auth');
const logger = require('winston'); // Assuming winston is used for logging


logger.configure({
  transports: [
    new logger.transports.Console(),
    new logger.transports.File({ filename: 'error.log' })
  ],
  format: logger.format.combine(
    logger.format.timestamp(),
    logger.format.json()
  )
});


const util = require('util');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Make sure this path exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname)
  }
});


const upload = multer({ storage: storage });
//amplitude = new Amplitude('679c4c4c2055cae6b3040752ccb0470')

amplitude.init('679c4c4c2055cae6b3040752ccb0470');
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


// Define public routes
// const publicRoutes = [
//   '/api/send-otp',
//   '/api/verify-otp', 
//   '/api/users/saveUserDetails',
//   '/constant',
//   '/api/colors'
// ];

// // Authentication middleware - add this before any route definitions
// app.use((req, res, next) => {
//   // Check if the route is public
//   if (publicRoutes.some(route => req.path.startsWith(route))) {
//       return next();
//   }

//   // For all other routes, apply authentication
//   authenticateToken(req, res, next);
// });



const protectedRoutes = [
  // Property routes
  // '/api/details',
  //'/api/properties/user',
  //'/api/properties/building',
  //'/api/properties/filter',
  //'/api/properties/all',
  //'/api/upload/property',
  //'/api/properties/emi-based',

  // Building routes
  // '/api/buildings',
  //'/api/buildings/saveBuildingDetails',

  // User routes
  '/api/users/profile',
  '/api/users/update-phone',
  '/api/users/history',

  // Builder routes
  //'/builders',
  //'/api/builders',

  // Project routes
  //'/api/projects',

  // List options routes
  //'/api/list-options',

  // Carousel routes
  '/api/carousels'
];

// Authentication middleware
app.use((req, res, next) => {
  // Skip authentication for OPTIONS requests (for CORS)
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Check if the current path matches any protected route patterns
  const requiresAuth = protectedRoutes.some(route => {
    // Convert route pattern to regex to match paths that start with the route
    const routePattern = new RegExp(`^${route}`);
    return routePattern.test(req.path);
  });

  if (requiresAuth) {
    // Apply authentication for protected routes
    return authenticateToken(req, res, next);
  }

  // No authentication required for other routes
  next();
});


const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});



const crypto = require('crypto');

// Enhanced OTP generation
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// Create a separate model for OTP
const otpSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '5m' } // OTP expires after 5 minutes
});

const OTP = mongoose.model('OTP', otpSchema);


// Send OTP endpoint
app.post('/api/send-otp', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
    logger.warn('Invalid phone number attempt', {
      phoneNumber,
      errorType: 'validation_error'
    });
    return res.status(400).json({ status_code: '400', success: 'false', msg: 'Invalid phone number' });
  }

  try {
    // Check if an OTP was recently sent
    const recentOTP = await OTP.findOne({ phoneNumber, createdAt: { $gt: new Date(Date.now() - 60000) } });
    if (recentOTP) {
      logger.info('Rate limit hit - Recent OTP exists', {
        phoneNumber,
        lastOTPTime: recentOTP.createdAt
      });
      return res.status(429).json({ status_code: '429', success: 'false', msg: 'Please wait before requesting a new OTP' });
    }

    // Check if the user has exceeded the daily limit
    const dailyCount = await OTP.countDocuments({
      phoneNumber,
      createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    if (dailyCount >= 5) {
      logger.info('Daily limit exceeded', {
        phoneNumber,
        dailyCount,
        date: new Date()
      });
      return res.status(429).json({ status_code: '429', success: 'false', msg: 'Daily OTP limit exceeded. Please try again tomorrow.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    // Log the API request
    logger.info('Sending OTP request', {
      phoneNumber,
      apiUrl: OTP_URL
    });

    const response = await axios.get(OTP_URL, {
      params: {
        authorization: API_KEY,
        route: 'otp',
        variables_values: otp,
        numbers: phoneNumber,
        flash: '0'
      }
    });

    // Log the API response
    logger.info('OTP API response received', {
      phoneNumber,
      success: response.data.return,
      responseData: response.data
    });

    if (response.data.return === true) {
      await OTP.create({ phoneNumber, otp });
      logger.info('OTP sent and saved successfully', {
        phoneNumber
      });
      res.json({ status_code: '200', success: 'true', msg: 'OTP sent successfully' });
    } else {
      logger.error('OTP service returned failure', {
        phoneNumber,
        responseData: response.data
      });
      res.status(400).json({ status_code: '400', success: 'false', msg: 'Failed to send OTP' });
    }
  } catch (error) {
    // Detailed error logging
    logger.error('Error in OTP sending process', {
      phoneNumber,
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      // If it's an axios error, log additional details
      axiosError: error.isAxiosError ? {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          params: error.config?.params
        }
      } : null
    });

    // Determine if it's a database error
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      logger.error('Database error during OTP operation', {
        errorCode: error.code,
        errorMessage: error.message
      });
    }

    res.status(500).json({ status_code: '500', success: 'false', msg: 'Internal server error' });
  }
});


app.delete('/api/buildings/:buildingId', async (req, res) => {
  try {
    const buildingId = req.params.buildingId;

    // Delete the building
    const deletedBuilding = await Building.findOneAndDelete({ buildingId: buildingId });

    if (!deletedBuilding) {
      return res.status(404).json({ message: 'Building not found' });
    }

    res.json({ message: 'Building deleted successfully', deletedBuilding });
  } catch (error) {
    console.error('Error deleting building:', error);
    res.status(500).json({ message: 'Error deleting building' });
  }
});



// Verify OTP endpoint
// app.post('/api/verify-otp', async (req, res) => {
//   const { phoneNumber, otp } = req.body;

//   if (!phoneNumber || !/^\d{10}$/.test(phoneNumber) || !otp || !/^\d{6}$/.test(otp)) {
//     return res.status(400).json({ status_code: '400', success: 'false', msg: 'Invalid phone number or OTP' });
//   }

//   try {
//     const otpDoc = await OTP.findOne({ phoneNumber });

//     if (!otpDoc) {
//       return res.status(400).json({ status_code: '400', success: 'false', msg: 'No OTP found for this number' });
//     }

//     // Check if 3 attempts have been made
//     if (otpDoc.attempts >= 3) {
//       return res.status(429).json({ status_code: '429', success: 'false', msg: 'Maximum attempts reached. Please request a new OTP.' });
//     }

//     // Check if enough time has passed since the last attempt (e.g., 1 minute)
//     if (otpDoc.lastAttemptAt && new Date() - otpDoc.lastAttemptAt < 60000) {
//       return res.status(429).json({ status_code: '429', success: 'false', msg: 'Please wait before trying again' });
//     }

//     // Increment attempts and update last attempt time
//     otpDoc.attempts += 1;
//     otpDoc.lastAttemptAt = new Date();
//     await otpDoc.save();

//     if (otpDoc.otp !== otp) {
//       return res.status(400).json({ status_code: '400', success: 'false', msg: 'Invalid OTP' });
//     }

//     // OTP is valid, delete it and update user
//     await OTP.deleteOne({ _id: otpDoc._id });

//     // Here you might want to update the user's verified status
//     await User.findOneAndUpdate({ phone: phoneNumber }, { $set: { isPhoneVerified: true } });

//     res.json({ status_code: '200', success: 'true', msg: 'OTP verified successfully' });
//   } catch (error) {
//     console.error('Error verifying OTP:', error);
//     res.status(500).json({ status_code: '500', success: 'false', msg: 'Internal server error' });
//   }
// });


// Modify existing verify-otp endpoint to handle both initial verification and updates
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, email } = req.body;

    const otpDoc = await OTP.findOne({ phoneNumber });

    if (!otpDoc || otpDoc.otp !== otp) {
      return res.status(400).json({
        status_code: '400',
        success: 'false',
        msg: 'Invalid OTP'
      });
    }

    // First try to find user by email (for Google sign-in users)
    let user = await User.findOne({ email });

    // If no user found by email, try phone number
    if (!user) {
      user = await User.findOne({ phone: phoneNumber });

      // If still no user found, create new user (for phone-only signup)
      if (!user) {
        user = new User({
          phone: phoneNumber,
          loginType: 'PHONE',
          isPhoneVerified: true,
          lastLogin: new Date(),
          verificationStatus: {
            phone: true
          },
          profile: {
            notifications: {
              email: true,
              push: true,
              priceAlerts: false,
              savedSearchAlerts: true,
              smsNotifications: true
            }
          },
          activityLog: [{
            action: 'SIGNUP',
            timestamp: new Date(),
            details: {
              method: 'PHONE',
              phoneNumber
            }
          }]
        });
        await user.save();
      }
    } else {
      // Update existing Google user's phone details
      user.phone = phoneNumber;
      user.isPhoneVerified = true;
      user.lastLogin = new Date();
      user.verificationStatus.phone = true;
      user.activityLog.push({
        action: 'PHONE_VERIFICATION',
        timestamp: new Date(),
        details: {
          method: 'OTP',
          phoneNumber
        }
      });
      await user.save();
    }

    // Generate new token
    const token = user.generateAuthToken();

    // Delete OTP document
    await OTP.deleteOne({ _id: otpDoc._id });

    res.json({
      status_code: '200',
      success: 'true',
      msg: 'Phone verified successfully',
      data: {
        user_id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        is_phone_verified: user.isPhoneVerified,
        token,
        profile: user.profile,
        verificationStatus: user.verificationStatus,
        // Only include non-sensitive preferences/settings
        preferences: user.profile?.preferences,
        notifications: user.profile?.notifications
      }
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    // Log the error in activity log if user exists
    if (error.user) {
      error.user.activityLog.push({
        action: 'OTP_VERIFICATION_ERROR',
        timestamp: new Date(),
        details: {
          error: error.message
        }
      });
      await error.user.save();
    }
    res.status(500).json({
      status_code: '500',
      success: 'false',
      msg: 'Failed to verify OTP',
      error: error.message
    });
  }
});


app.post('/api/users/saveUserDetails', async (req, res) => {
  try {
    const {
      name,
      email,
      socialId,
      loginType
    } = req.body;

    // Validate required fields for Google login
    if (!email || !socialId) {
      return res.status(400).json({
        status_code: '400',
        success: 'false',
        msg: 'Email and socialId are required for Google login'
      });
    }

    // Find user by email or socialId
    let user = await User.findOne({
      $or: [
        { email },
        { socialId }
      ]
    });

    let isNewUser = false;

    if (user) {
      // Update existing user's Google details
      user.name = name || user.name;
      user.socialId = socialId;
      user.loginType = 'GOOGLE'; // Force loginType to be 'GOOGLE'
      if (email) user.email = email;

      await user.save();
    } else {
      // Create new user with Google details
      isNewUser = true;
      user = new User({
        name,
        email,
        socialId,
        loginType: 'GOOGLE', // Force loginType to be 'GOOGLE'
        profile: {
          notifications: {
            email: true,
            push: true
          }
        }
      });
      await user.save();
    }

    // Generate authentication token
    const token = user.generateAuthToken();

    const response = {
      status_code: '200',
      success: 'true',
      msg: isNewUser ? 'User created successfully' : 'Welcome back!',
      REAL_ESTATE_APP: {  // Modified to match your expected response format
        user_id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        token,
        profile: user.profile,
        requires_phone: !user.phone // Flag to indicate if phone number is needed
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in saveUserDetails:', error);
    res.status(500).json({
      status_code: '500',
      success: 'false',
      msg: 'Failed to save user details',
      error: error.message
    });
  }
});

// app.post('/api/verify-otp', async (req, res) => {
//   try {
//       const { phoneNumber, otp } = req.body;

//       const otpDoc = await OTP.findOne({ phoneNumber });

//       if (!otpDoc || otpDoc.otp !== otp) {
//           return res.status(400).json({
//               status_code: '400',
//               success: 'false',
//               msg: 'Invalid OTP'
//           });
//       }

//       // Find and update user
//       const user = await User.findOneAndUpdate(
//           { phone: phoneNumber },
//           { 
//               $set: { 
//                   isPhoneVerified: true,
//                   lastLogin: new Date()
//               }
//           },
//           { new: true }
//       );

//       if (!user) {
//           return res.status(404).json({
//               status_code: '404',
//               success: 'false',
//               msg: 'User not found'
//           });
//       }

//       // Generate new token with updated information
//       const token = user.generateAuthToken();

//       // Delete OTP document
//       await OTP.deleteOne({ _id: otpDoc._id });

//       res.json({
//           status_code: '200',
//           success: 'true',
//           msg: 'Phone verified successfully',
//           data: {
//               user_id: user._id,
//               name: user.name,
//               email: user.email,
//               phone: user.phone,
//               is_phone_verified: true,
//               token,
//               profile: user.profile
//           }
//       });
//   } catch (error) {
//       console.error('Error verifying OTP:', error);
//       res.status(500).json({
//           status_code: '500',
//           success: 'false',
//           msg: 'Failed to verify OTP',
//           error: error.message
//       });
//   }
// });

// Add phone number endpoint
app.post('/api/users/update-phone', authenticateToken, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        status_code: '400',
        success: 'false',
        msg: 'Phone number is required'
      });
    }

    // Check if phone number is already in use by another user
    const existingUserWithPhone = await User.findOne({
      phone,
      _id: { $ne: req.user.id }
    });

    if (existingUserWithPhone) {
      return res.status(400).json({
        status_code: '400',
        success: 'false',
        msg: 'Phone number is already registered with another account'
      });
    }

    // Update user's phone number
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          phone,
          isPhoneVerified: false // Reset verification status
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        status_code: '404',
        success: 'false',
        msg: 'User not found'
      });
    }

    // Generate and send OTP
    const otp = generateOTP();
    await OTP.create({
      phoneNumber: phone,
      otp,
      attempts: 0
    });

    // Send OTP via your existing SMS service
    const response = await axios.get(OTP_URL, {
      params: {
        authorization: API_KEY,
        route: 'otp',
        variables_values: otp,
        numbers: phone,
        flash: '0'
      }
    });

    if (response.data.return === true) {
      res.json({
        status_code: '200',
        success: 'true',
        msg: 'OTP sent successfully',
        REAL_ESTATE_APP: {
          user_id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone
        }
      });
    } else {
      res.status(400).json({
        status_code: '400',
        success: 'false',
        msg: 'Failed to send OTP'
      });
    }

  } catch (error) {
    console.error('Error updating phone:', error);
    res.status(500).json({
      status_code: '500',
      success: 'false',
      msg: 'Failed to update phone number',
      error: error.message
    });
  }
});

// Get user profile endpoint
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-socialId -__v');

    if (!user) {
      return res.status(404).json({
        status_code: '404',
        success: 'false',
        msg: 'User not found'
      });
    }

    res.json({
      status_code: '200',
      success: 'true',
      msg: 'Profile retrieved successfully',
      data: {
        user_id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        is_phone_verified: user.isPhoneVerified,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      status_code: '500',
      success: 'false',
      msg: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Keep your existing routes...

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    status_code: err.status || '500',
    success: 'false',
    msg: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});


// Track property view
app.post('/api/users/history/view', authenticateToken, async (req, res) => {
  try {
    const { propertyId, timeSpent } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          'history.viewedProperties': {
            propertyId,
            timestamp: Date.now(),
            timeSpent
          }
        }
      },
      { new: true }
    );

    res.json({
      status_code: '200',
      success: 'true',
      msg: 'Property view tracked successfully',
      history: user.history.viewedProperties
    });
  } catch (error) {
    console.error('Error tracking property view:', error);
    res.status(500).json({
      status_code: '500',
      success: 'false',
      msg: 'Failed to track property view'
    });
  }
});

// Toggle property like
app.post('/api/users/history/like', authenticateToken, async (req, res) => {
  try {
    const { propertyId, action } = req.body;

    let update;
    if (action === 'LIKE') {
      update = {
        $addToSet: {
          'history.likedProperties': {
            propertyId,
            timestamp: Date.now()
          }
        }
      };
    } else {
      update = {
        $pull: {
          'history.likedProperties': {
            propertyId
          }
        }
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true }
    );

    res.json({
      status_code: '200',
      success: 'true',
      msg: `Property ${action.toLowerCase()}d successfully`,
      likedProperties: user.history.likedProperties
    });
  } catch (error) {
    console.error('Error updating property like:', error);
    res.status(500).json({
      status_code: '500',
      success: 'false',
      msg: 'Failed to update property like'
    });
  }
});

// Get user profile with history
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-socialId -__v');

    if (!user) {
      return res.status(404).json({
        status_code: '404',
        success: 'false',
        msg: 'User not found'
      });
    }

    res.json({
      status_code: '200',
      success: 'true',
      msg: 'Profile retrieved successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profile: user.profile,
        history: user.history
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      status_code: '500',
      success: 'false',
      msg: 'Failed to fetch profile'
    });
  }
});



// Check if S3 is connected
s3.listBuckets((err, data) => {
  if (err) {
    console.error("Error connecting to AWS S3:", err);
  } else {
    console.log("Connected to AWS S3. Buckets:", data.Buckets);
  }
});


const additionalUrls = [
  "https://additional-example1.com",
  "https://additional-example2.com",
  "https://additional-example3.com"
];

constantData.homeUrls.push(...additionalUrls);

// Define a route to return the constant data
app.get('/constant', (req, res) => {
  res.json(constantData);
});



// Retrieve the color gradient data from MongoDB
app.get('/api/colors', async (req, res) => {
  try {
    const colorData = await ColorGradient.findOne({});
    res.status(200).json(colorData);
  } catch (error) {
    console.error('Error retrieving color gradient data:', error);
    res.status(500).json({ status_code: '500', success: 'false', msg: 'Failed to retrieve color gradient data' });
  }
});

app.get('/api/colors/ads', async (req, res) => {
  try {
    const colorData = await ColorGradient.findOne({});
    if (!colorData) {
      return res.status(404).json({ message: 'Color gradient data not found' });
    }
    res.status(200).json(colorData.ads || []);
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ message: 'Error fetching ads', error: error.message });
  }
});

// Add a new ad
app.post('/api/colors/ads', async (req, res) => {
  try {
    const newAd = req.body;
    const colorData = await ColorGradient.findOne({});
    if (!colorData) {
      return res.status(404).json({ message: 'Color gradient data not found' });
    }
    colorData.ads = colorData.ads || [];
    colorData.ads.push(newAd);
    await colorData.save();
    res.status(201).json(newAd);
  } catch (error) {
    console.error('Error adding new ad:', error);
    res.status(500).json({ message: 'Error adding new ad', error: error.message });
  }
});

// Update an existing ad
app.put('/api/colors/ads/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const updatedAd = req.body;
    const colorData = await ColorGradient.findOne({});
    if (!colorData) {
      return res.status(404).json({ message: 'Color gradient data not found' });
    }
    const adIndex = colorData.ads.findIndex(ad => ad._id.toString() === adId);
    if (adIndex === -1) {
      return res.status(404).json({ message: 'Ad not found' });
    }
    colorData.ads[adIndex] = { ...colorData.ads[adIndex].toObject(), ...updatedAd };
    await colorData.save();
    res.status(200).json(colorData.ads[adIndex]);
  } catch (error) {
    console.error('Error updating ad:', error);
    res.status(500).json({ message: 'Error updating ad', error: error.message });
  }
});

// Delete an ad
app.delete('/api/colors/ads/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const colorData = await ColorGradient.findOne({});
    if (!colorData) {
      return res.status(404).json({ message: 'Color gradient data not found' });
    }
    colorData.ads = colorData.ads.filter(ad => ad._id.toString() !== adId);
    await colorData.save();
    res.status(200).json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ message: 'Error deleting ad', error: error.message });
  }
});

app.post('/api/colors/update', async (req, res) => {
  try {
    const updatedColorData = req.body;
    console.log('Received request body:', updatedColorData);

    const colorData = await ColorGradient.findOne({});
    if (colorData) {
      // Only update fields that are present in the request body
      Object.keys(updatedColorData).forEach(key => {
        if (key === 'ads') {
          // Check if ads array exists and has items
          if (Array.isArray(updatedColorData.ads) && updatedColorData.ads.length > 0) {
            // Check if any ad has a non-empty pagelink
            const hasValidAds = updatedColorData.ads.some(ad => ad.pagelink && ad.pagelink.trim() !== '');
            if (hasValidAds) {
              colorData.ads = updatedColorData.ads;
            }
          }
        } else {
          colorData[key] = updatedColorData[key];
        }
      });

      await colorData.save();

      // Fetch the updated document from MongoDB and print it
      const updatedDocument = await ColorGradient.findOne({});
      console.log('Updated ColorGradient document in MongoDB:', JSON.stringify(updatedDocument, null, 2));

      res.status(200).json(colorData);
    } else {
      res.status(400).json({ error: 'Color gradient data not found' });
    }
  } catch (error) {
    console.error('Error updating color gradient data:', error);
    res.status(500).json({ status_code: '500', success: 'false', msg: 'Failed to update color gradient data' });
  }
});
app.post('/api/colors/update-ads', async (req, res) => {
  try {
    const updatedAds = req.body.ads;
    console.log('Received updated ads:', updatedAds);

    const colorData = await ColorGradient.findOne({});
    if (colorData) {
      // If colorData.ads doesn't exist, initialize it as an empty array
      if (!Array.isArray(colorData.ads)) {
        colorData.ads = [];
      }

      updatedAds.forEach(updatedAd => {
        const existingAdIndex = colorData.ads.findIndex(ad => ad.name === updatedAd.name);

        if (existingAdIndex !== -1) {
          // Update existing ad
          colorData.ads[existingAdIndex] = {
            ...colorData.ads[existingAdIndex],
            ...updatedAd
          };
        } else {
          // Add new ad
          colorData.ads.push(updatedAd);
        }
      });

      await colorData.save();
      res.status(200).json(colorData);
    } else {
      res.status(400).json({ error: 'Color gradient data not found' });
    }
  } catch (error) {
    console.error('Error updating ads:', error);
    res.status(500).json({ status_code: '500', success: 'false', msg: 'Failed to update ads' });
  }
});

// Define your API endpoint
app.get('/api/colors', (req, res) => {
  // Send the color gradient data JSON object
  res.json(colorGradientData);
});


// MongoDB Connection
mongoose.connect('mongodb+srv://ofospace:bnmopbnmop%401010@cluster0.eb5nwll.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB connection error:", err));


// Ensure the uploads directory exists
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created the uploads directory.');
}

async function getLocationFromIP(ipAddress) {
  try {
    const response = await axios.get(`https://ipinfo.io/${ipAddress}/json`);
    return response.data;
  } catch (error) {
    console.error('Error fetching location data:', error);
    throw error;
  }
}


/**
 * Function to send event data to Amplitude
 * @param {string} userId The ID of the user associated with the event
 * @param {string} eventName The name of the event to be tracked
 * @param {object} eventProperties Additional properties to be tracked with the event
 */
async function sendEventToAmplitude(userId, eventName, eventProperties) {
  try {
    // Log the event data
    console.log('Tracking event:', eventName);
    console.log('User ID:', userId);
    console.log('Event Properties:', eventProperties);

    // Track event using Amplitude SDK
    amplitude.track({
      user_id: userId,
      event_type: eventName,
      event_properties: eventProperties
    }, (err, response) => {
      if (err) {
        console.error('Error tracking event:', err);
      } else {
        console.log('Event tracked successfully:', response);
      }
    });
  } catch (error) {
    console.error('Error sending event to Amplitude:', error);
  }
}


app.get('/api/update_properties', async (req, res) => {
  try {
    //   const propertiesWithoutPostId = await Property.find({ post_id: null });

    const propertiesWithoutPostId = await Property.find();

    propertiesWithoutPostId.forEach(async property => {
      property.post_id = generatePostId();
      await property.save();
      console.log(`Property with missing post_id updated. New post_id: ${property.post_id}`);
    });
    res.status(200).send("Properties updated successfully");
  } catch (error) {
    console.error("Error updating properties:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Add this to your server.js file

const LocalHomeFeed = require('./LocalHomeFeed');

// Create
app.post('/api/local-home-feed', async (req, res) => {
  try {
    const feedData = req.body;

    // Extract unique cities from items
    const cities = [...new Set(feedData.items.map(item => item.cityName))];
    feedData.cities = cities;

    const newFeed = new LocalHomeFeed(feedData);
    const savedFeed = await newFeed.save();
    res.status(201).json(savedFeed);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Read (all)
app.get('/api/local-home-feed', async (req, res) => {
  try {
    const feeds = await LocalHomeFeed.find();
    res.json(feeds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Read (by ID)
app.get('/api/local-home-feed/:id', async (req, res) => {
  try {
    const feed = await LocalHomeFeed.findById(req.params.id);
    if (!feed) return res.status(404).json({ message: 'Feed not found' });
    res.json(feed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update
app.put('/api/local-home-feed/:id', async (req, res) => {
  try {
    const feedData = req.body;

    // Extract unique cities from items
    const cities = [...new Set(feedData.items.map(item => item.cityName))];
    feedData.cities = cities;

    const updatedFeed = await LocalHomeFeed.findByIdAndUpdate(req.params.id, feedData, { new: true });
    if (!updatedFeed) return res.status(404).json({ message: 'Feed not found' });
    res.json(updatedFeed);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete
app.delete('/api/local-home-feed/:id', async (req, res) => {
  try {
    const deletedFeed = await LocalHomeFeed.findByIdAndDelete(req.params.id);
    if (!deletedFeed) return res.status(404).json({ message: 'Feed not found' });
    res.json({ message: 'Feed deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const NodeGeocoder = require('node-geocoder');

const geocoder = NodeGeocoder({
  provider: 'openstreetmap'
});

app.get('/api/local-home-feed/by-location', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    // Get the city name from coordinates
    const geoResults = await geocoder.reverse({ lat: latitude, lon: longitude });

    if (geoResults.length === 0) {
      return res.status(404).json({ message: 'Unable to determine city from given coordinates' });
    }

    const city = geoResults[0].city;

    if (!city) {
      return res.status(404).json({ message: 'City not found for given coordinates' });
    }

    // Find LocalHomeFeed documents that include the matching city
    const feeds = await LocalHomeFeed.find({ cities: city });

    if (feeds.length === 0) {
      return res.status(404).json({ message: 'No local home feed found for the determined city' });
    }

    // Filter items to only include the matching city
    const filteredFeeds = feeds.map(feed => ({
      ...feed.toObject(),
      items: feed.items.filter(item => item.cityName === city)
    }));

    res.json(filteredFeeds);
  } catch (error) {
    console.error('Error in local home feed by location:', error);
    res.status(500).json({ message: 'An error occurred while fetching local home feed', error: error.message });
  }
});




// Modify your existing enhanced home feed endpoint to include carousels
app.get('/api/enhanced-home-feed', async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    // Get active carousels
    const carousels = await Carousel.find({ status: 'active' })
      .populate('items.propertyId')
      .populate('items.locationId');

    // Rest of your existing home feed logic...

    // Add carousels to the home feed sections
    const carouselSections = carousels.map(carousel => ({
      sectionId: carousel.carouselId,
      sectionType: 'carousel',
      title: carousel.name,
      carouselData: {
        carouselId: carousel.carouselId,
        autoPlay: carousel.autoPlay,
        autoPlayInterval: carousel.autoPlayInterval,
        showIndicator: carousel.showIndicator,
        items: carousel.items.map(item => {
          switch (item.type) {
            case 'banner':
              return {
                type: 'banner',
                id: item._id.toString(),
                imageUrl: item.imageUrl,
                title: item.title,
                subtitle: item.subtitle,
                actionUrl: item.actionUrl,
                backgroundColor: item.backgroundColor
              };
            case 'property':
              return {
                type: 'property',
                id: item._id.toString(),
                property: item.propertyId ? {
                  propertyId: item.propertyId._id.toString(),
                  image: item.propertyId.post_image,
                  title: item.propertyId.post_title,
                  price: item.propertyId.price.toString(),
                  location: item.propertyId.location
                } : null
              };
            case 'location':
              return {
                type: 'location',
                id: item._id.toString(),
                location: item.locationId ? {
                  locationId: item.locationId._id.toString(),
                  name: item.locationId.name,
                  image: item.locationId.images[0],
                  statistics: item.locationId.statistics
                } : null
              };
          }
        }).filter(item => item !== null)
      }
    }));

    // Insert carousels at appropriate positions in your home feed
    const homeFeed = [
      // Your existing sections...
      ...carouselSections
    ];

    res.json(homeFeed);
  } catch (error) {
    console.error('Error fetching enhanced home feed:', error);
    res.status(500).json({ message: 'Error fetching home feed data' });
  }
});



function generatePostId() {
  const maxDigits = 13;
  const maxNumber = Math.pow(10, maxDigits) - 1; // Maximum 13-digit number
  const minNumber = Math.pow(10, maxDigits - 1); // Minimum 13-digit number

  // Generate a random integer within the specified range
  const postId = Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber;

  return postId;
}

function cleanIpAddress(ip) {
  // Remove IPv6 prefix if present and get the IPv4 part
  if (ip.includes('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  return ip;
}

async function getLocationFromIP(ipAddress) {
  try {
    // Clean the IP address before making the request
    const cleanedIP = cleanIpAddress(ipAddress);

    // Add timeout to the request
    const response = await axios.get(`https://ipinfo.io/${cleanedIP}/json`, {
      timeout: 3000, // 3 second timeout
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    // Validate response
    if (response.data && response.status === 200) {
      console.log('Location data retrieved successfully:', {
        ip: cleanedIP,
        city: response.data.city,
        region: response.data.region
      });
      return response.data;
    }

    throw new Error('Invalid response from location service');

  } catch (error) {
    // Provide detailed error logging
    console.warn('Location lookup failed:', {
      originalIP: ipAddress,
      cleanedIP: cleanIpAddress(ipAddress),
      errorCode: error.code,
      errorMessage: error.message,
      response: error.response?.data
    });

    // Return a default location object instead of throwing
    return {
      ip: cleanIpAddress(ipAddress),
      city: 'Unknown',
      region: 'Unknown',
      country: 'Unknown',
      loc: '0,0',
      error: true
    };
  }
}

// Endpoint to fetch property details by ID ==============//
app.get('/api/details/:id', async (req, res, next) => {
  try {
    console.log(`Fetching details for property ID: ${req.params.id}`);
    const propertyId = req.params.id;

    if (!propertyId) {
      throw new Error('Property ID is required');
    }

    // Track client information with better error handling
    const clientIp = req.ip || req.connection.remoteAddress;
    let locationData = {
      city: 'Unknown',
      region: 'Unknown',
      country: 'Unknown'
    };

    try {
      const locationResult = await getLocationFromIP(clientIp);
      if (!locationResult.error) {
        locationData = locationResult;
      }
    } catch (locationError) {
      console.warn('Location lookup failed:', locationError.message);
      // Continue with default location data
    }

    // Track analytics event with error handling
    // try {
    //   const userId = "37827382" + propertyId;
    //   await sendEventToAmplitude(userId, 'property_view', {
    //     property_id: propertyId,
    //     client_ip: cleanIpAddress(clientIp),
    //     location: {
    //       city: locationData.city,
    //       region: locationData.region,
    //       country: locationData.country
    //     }
    //   });
    // } catch (analyticsError) {
    //   console.warn('Analytics tracking failed:', analyticsError.message);
    // }

    // Find property with timeout
    const property = await Promise.race([
      Property.findOne({ post_id: propertyId }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      )
    ]);

    if (!property) {
      const error = new Error('Property not found');
      error.status = 404;
      throw error;
    }

    // Increment view count asynchronously
    Property.updateOne(
      { post_id: propertyId },
      { $inc: { total_views: 1 } }
    ).catch(err => console.warn('View count update failed:', err));

    if (property) {
      res.json(property);
    } else {
      res.status(404).send('Property not found');
    }

  } catch (error) {
    next(error);
  }
});

// Endpoint to fetch properties by user ID
app.get('/api/properties/user/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Use find to get all properties with the matching user_id
    const properties = await Property.find({ user_id: userId });

    if (properties.length > 0) {
      res.json(properties);
    } else {
      res.status(404).send('No properties found for the specified user ID');
    }
  } catch (error) {
    console.error(`Error fetching properties for user ID ${userId}:`, error);
    res.status(500).send('Error fetching properties');
  }
});





app.get('/api/properties/all', async (req, res) => {
  try {
    // Fetch all properties from the MongoDB collection
    const allProperties = await Property.find();
    res.json(allProperties); // Return the properties as JSON
  } catch (error) {
    console.error('Error fetching properties from MongoDB:', error);
    res.status(500).json({ message: 'Error fetching properties from MongoDB' });
  }
});

app.post('/api/buildings/saveBuildingDetails', upload.fields([{ name: 'galleryList', maxCount: 5 }]), async (req, res) => {
  try {
    console.log('Received request to save building details');

    const BuildingData = JSON.parse(req.body.data || '{}');
    console.log('Parsed building data:', BuildingData);

    const uploadedImages = [];

    if (req.files['galleryList']) {
      console.log('Processing gallery images:', req.files['galleryList']);

      for (const galleryImageFile of req.files['galleryList']) {
        const galleryImageParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `gallery_images/${uuid.v4()}_${galleryImageFile.originalname}`,
          Body: fs.createReadStream(galleryImageFile.path),
        };
        const galleryImageUploadResult = await s3.upload(galleryImageParams).promise();
        uploadedImages.push(galleryImageUploadResult.Location);
      }

      console.log('Uploaded gallery images:', uploadedImages);
    } else {
      console.log('No gallery images found');
    }

    BuildingData.galleryList = uploadedImages;

    // Handle new fields
    BuildingData.numberOfFlatsAvailable = parseInt(BuildingData.numberOfFlatsAvailable);
    BuildingData.totalFloors = parseInt(BuildingData.totalFloors);

    // Ensure flatsDetails is properly formatted
    if (Array.isArray(BuildingData.flatsDetails)) {
      BuildingData.flatsDetails = BuildingData.flatsDetails.map(detail => ({
        floorNumber: parseInt(detail.floorNumber),
        flatsOnFloor: parseInt(detail.flatsOnFloor),
        availableFlats: parseInt(detail.availableFlats)
      }));
    }

    // Handle connectedProperties (assuming these are Property IDs)
    if (Array.isArray(BuildingData.connectedProperties)) {
      BuildingData.connectedProperties = BuildingData.connectedProperties.map(id => mongoose.Types.ObjectId(id));
    }

    console.log('Building data with updated fields:', BuildingData);

    const newBuilding = new Building(BuildingData);
    await newBuilding.save();

    console.log('Building details saved successfully:', newBuilding);
    res.status(201).json(newBuilding);
  } catch (error) {
    console.error('Error saving building details:', error);
    res.status(500).json({ error: 'Error saving building details' });
  }
});


// Route to get all properties with the same building_id
app.get('/api/properties/building/:buildingId', async (req, res) => {
  const buildingId = req.params.buildingId;
  console.log('Received request for building properties with ID:', buildingId);

  try {
    console.log('Searching for properties with building_id:', buildingId);
    // Use find to get all properties with the matching building_id
    const properties = await Property.find({ building_id: buildingId });

    console.log('Query executed. Found properties:', properties.length);

    if (properties.length > 0) {
      console.log('Properties found:', {
        count: properties.length,
        propertyIds: properties.map(p => p.post_id),
        propertyTypes: properties.map(p => p.type_name)
      });
      res.json(properties);
    } else {
      console.log('No properties found for building ID:', buildingId);
      res.status(408).send('No properties found for the specified building ID');
    }
  } catch (error) {
    console.error('Error fetching properties:', {
      buildingId: buildingId,
      errorMessage: error.message,
      errorStack: error.stack
    });
    res.status(500).send('Error fetching properties');
  }
});



app.get('/api/properties/emi-based', async (req, res) => {
  try {
    const { loanAmount, downPayment, interestRate, loanTenure } = req.query;

    // Validate input parameters
    if (!loanAmount || !downPayment || !interestRate || !loanTenure) {
      return res.status(400).json({ message: 'All EMI parameters are required' });
    }

    // Convert parameters to numbers
    const principal = parseFloat(loanAmount) + parseFloat(downPayment);
    const rate = parseFloat(interestRate) / 100 / 12; // Monthly interest rate
    const time = parseFloat(loanTenure) * 12; // Total months

    // Calculate maximum affordable property price (which is principal in this case)
    const maxPropertyPrice = principal;

    // Find properties within the affordable price range
    const affordableProperties = await Property.find({
      price: { $lte: maxPropertyPrice }
    }).sort({ price: -1 }); // Sort by price descending

    // Calculate EMI for each property
    const propertiesWithEMI = affordableProperties.map(property => {
      const propertyLoanAmount = property.price - parseFloat(downPayment);
      const emi = (propertyLoanAmount * rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);

      return {
        ...property.toObject(),
        calculatedEMI: Math.round(emi)
      };
    });

    res.json({
      maxAffordablePrice: maxPropertyPrice,
      properties: propertiesWithEMI
    });

  } catch (error) {
    console.error('Error in EMI-based property search:', error);
    res.status(500).json({ message: 'An error occurred while searching for properties', error: error.message });
  }
});

// Route to get all building data
app.get('/api/buildings', async (req, res) => {
  try {
    // Retrieve all buildings from the database
    const buildings = await Building.find();

    console.log(' building fetched :', buildings);
    res.status(200).json(buildings);
  } catch (error) {
    console.error('Error fetching building data:', error);
    res.status(500).json({ error: 'Error fetching building data' });
  }
});

// Route to remove buildings with no name
app.get('/api/removeBuilding', async (req, res) => {
  try {
    // Delete buildings where name is not present
    const result = await Building.deleteMany({ name: { $exists: false } });

    if (result.deletedCount > 0) {
      res.status(200).json({ message: 'Buildings with no name removed successfully' });
    } else {
      res.status(404).json({ message: 'No buildings with no name found' });
    }
  } catch (error) {
    console.error('Error removing buildings:', error);
    res.status(500).json({ error: 'Error removing buildings' });
  }
});


app.put('/api/list-options/:listName/update-details', async (req, res) => {
  try {
    const { listName } = req.params;
    const { title, headerImage } = req.body;

    const result = await ListOptions.findOneAndUpdate(
      { listName },
      {
        $set: {
          title,
          headerImage
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!result) {
      return res.status(404).json({
        message: "List not found"
      });
    }

    res.json({
      success: true,
      message: "List details updated successfully",
      list: result
    });

  } catch (error) {
    console.error('Error updating list details:', error);
    res.status(500).json({
      success: false,
      message: "Error updating list details",
      error: error.message
    });
  }
});

// Updated API endpoint
app.put('/api/list-options/:listName/update-option/:optionId', async (req, res) => {
  try {
    const { listName, optionId } = req.params;
    const updatedOption = req.body;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(optionId)) {
      return res.status(400).json({ message: "Invalid option ID format" });
    }

    // Find the document first to verify it exists
    const list = await ListOptions.findOne({
      listName: listName,
      "options._id": optionId
    });

    if (!list) {
      return res.status(404).json({ message: "List or option not found" });
    }

    // Update while preserving the _id
    const result = await ListOptions.findOneAndUpdate(
      {
        listName: listName,
        "options._id": optionId
      },
      {
        $set: {
          "options.$": {
            _id: optionId,  // Preserve the original _id
            imagelink: updatedOption.imagelink,
            textview: updatedOption.textview,
            link: updatedOption.link
          }
        }
      },
      {
        new: true,          // Return updated document
        runValidators: true // Run schema validators
      }
    );

    // Double-check the update was successful
    if (!result) {
      return res.status(404).json({ message: "Update failed" });
    }

    // Find the updated option in the result
    const updatedDoc = result.options.find(opt => opt._id.toString() === optionId);

    res.json({
      message: "Option updated successfully",
      updatedOption: updatedDoc
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      message: "Error updating option",
      error: error.message
    });
  }
});

// Helper function to verify an option exists
async function verifyOptionExists(listName, optionId) {
  const count = await ListOptions.countDocuments({
    listName: listName,
    "options._id": optionId
  });
  return count > 0;
}


// GET /api/list-options
app.get('/api/list-options', async (req, res) => {
  try {
    const options = await ListOptions.find({});
    res.json(options);
  } catch (error) {
    console.error('Error fetching list options:', error);
    res.status(500).json({ message: 'Error fetching list options', error: error.message });
  }
});


app.get('/api/buildings/:buildingId', async (req, res) => {
  try {
    const buildingId = req.params.buildingId;
    const building = await Building.findOne({ buildingId: buildingId })
      .populate('connectedProperties'); // This will populate the connectedProperties with actual Property documents

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    res.status(200).json(building);
  } catch (error) {
    console.error('Error fetching building details:', error);
    res.status(500).json({ error: 'Error fetching building details' });
  }
})

//9241700000


// Endpoint to upload a new property with images ===============================//
app.post('/api/upload/property', upload.fields([
  { name: 'post_image', maxCount: 1 },
  { name: 'floor_plan_image', maxCount: 1 },
  { name: 'galleryList', maxCount: 10 }
]), async (req, res) => {
  try {
    const propertyData = JSON.parse(req.body.data || '{}');
    const uploadedImages = [];

    // Upload post image to S3
    if (req.files['post_image']) {
      const postImageFile = req.files['post_image'][0];
      const postImageParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `post_images/${uuid.v4()}_${postImageFile.originalname}`,
        Body: fs.createReadStream(postImageFile.path),
      };
      const postImageUploadResult = await s3.upload(postImageParams).promise();
      uploadedImages.push(postImageUploadResult.Location);
    }

    // Upload floor plan image to S3
    if (req.files['floor_plan_image']) {
      const floorPlanImageFile = req.files['floor_plan_image'][0];
      const floorPlanImageParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `floor_plan_images/${uuid.v4()}_${floorPlanImageFile.originalname}`,
        Body: fs.createReadStream(floorPlanImageFile.path),
      };
      const floorPlanImageUploadResult = await s3.upload(floorPlanImageParams).promise();
      uploadedImages.push(floorPlanImageUploadResult.Location);
    }

    // Upload gallery images to S3
    if (req.files['galleryList']) {
      for (const galleryImageFile of req.files['galleryList']) {
        const galleryImageParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `gallery_images/${uuid.v4()}_${galleryImageFile.originalname}`,
          Body: fs.createReadStream(galleryImageFile.path),
        };
        const galleryImageUploadResult = await s3.upload(galleryImageParams).promise();
        uploadedImages.push(galleryImageUploadResult.Location);
      }
    }

    // Store the uploaded image paths in the property data
    propertyData.post_image = uploadedImages[0]; // Assuming only one post image
    propertyData.floor_plan_image = uploadedImages[1]; // Assuming only one floor plan image
    propertyData.galleryList = uploadedImages.slice(2); // Assuming gallery images start from index 2


    if (!propertyData.post_id) {
      propertyData.post_id = generatePostId(); // Generate a new post_id
    }


    // Save the property data to MongoDB
    const property = new Property(propertyData);
    await property.save();

    // Respond with the created property
    res.status(201).send(property);
  } catch (error) {
    console.error('Error uploading new property:', error);
    res.status(400).send(error.message);
  }
});


app.get('/api/properties/filter', async (req, res) => {
  console.log('Received filter request with query params:', req.query);
  try {
    const {
      bedrooms, bathrooms, latitude, longitude,
      priceMin, priceMax, type_name, sort, radius,
      furnishing, area, construction_status,
      carpetArea, superBuiltupArea, available, category,
      region, possession, broker_status, purpose,
      // EMI filter parameters
      emiAmount, loanTenureYears
    } = req.query;

    let filter = {};
    console.log('Constructing filter object...');

    // Apply 'buy' purpose filter only if EMI parameters are present
    if (emiAmount && loanTenureYears) {
      filter.purpose = new RegExp('^buy$', 'i'); // Case-insensitive match for 'buy'
    } else if (purpose) {
      // If EMI parameters are not present, use the purpose provided in the query (if any)
      filter.purpose = new RegExp(`^${purpose}$`, 'i'); // Case-insensitive match for provided purpose
    }

    // Existing filter logic
    if (bedrooms) filter.bedrooms = { $gte: Number(bedrooms) };
    if (bathrooms) filter.bathrooms = { $gte: Number(bathrooms) };
    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }
    if (type_name) filter.type_name = { $in: Array.isArray(type_name) ? type_name : [type_name] };
    if (furnishing) filter.furnishing = furnishing;
    if (area) filter.area = { $gte: Number(area) };
    if (construction_status) filter.construction_status = construction_status;
    if (carpetArea) filter.carpetArea = { $gte: Number(carpetArea) };
    if (superBuiltupArea) filter.superBuiltupArea = { $gte: Number(superBuiltupArea) };
    if (available !== undefined) filter.available = available === 'true';
    if (category) filter.category = Number(category);
    if (region) filter.region = region;
    if (possession) filter.possession = possession;
    if (broker_status) filter.broker_status = broker_status;

    // Geospatial query
    if (latitude && longitude) {
      const radiusInKm = radius ? parseFloat(radius) : 50;
      const radiusInMeters = radiusInKm * 1000;
      filter.$and = [
        { latitude: { $gte: Number(latitude) - (radiusInKm / 111.32) } },
        { latitude: { $lte: Number(latitude) + (radiusInKm / 111.32) } },
        { longitude: { $gte: Number(longitude) - (radiusInKm / (111.32 * Math.cos(Number(latitude) * Math.PI / 180))) } },
        { longitude: { $lte: Number(longitude) + (radiusInKm / (111.32 * Math.cos(Number(latitude) * Math.PI / 180))) } }
      ];
    }

    console.log('Final filter object:', JSON.stringify(filter, null, 2));

    // Sorting
    let sortOption = {};
    if (sort) {
      const order = sort.toLowerCase() === 'desc' ? -1 : 1;
      sortOption.price = order;
    } else {
      sortOption.price = 1; // Default sorting: price ascending
    }

    console.log('Executing property search...');
    let properties = await Property.find(filter).sort(sortOption).lean();
    console.log(`Found ${properties.length} properties matching filter`);

    // EMI-based filtering
    if (emiAmount && loanTenureYears) {
      const emiValue = parseFloat(emiAmount);
      const tenureMonths = parseFloat(loanTenureYears) * 12;
      const maxAffordablePrice = emiValue * tenureMonths;

      properties = properties.map(property => {
        const affordabilityRatio = property.price / maxAffordablePrice;
        return {
          ...property,
          affordabilityRatio,
          isAffordable: affordabilityRatio <= 1,
          emiPercentage: (emiValue / property.price) * 100
        };
      });

      // Filter out unaffordable properties
      properties = properties.filter(property => property.isAffordable);

      // Sort properties by affordability ratio (most affordable first)
      properties.sort((a, b) => a.affordabilityRatio - b.affordabilityRatio);
    }

    res.json({
      totalProperties: properties.length,
      properties: properties
    });
  } catch (error) {
    console.error('Error in /api/properties/filter:', error);
    res.status(500).json({ message: "An error occurred while fetching properties.", error: error.message });
  }
});


// New API for filtering properties by price range
app.get('/api/properties/priceRange', async (req, res) => {
  const { priceMin, priceMax } = req.query;

  let filter = {};

  if (priceMin) filter.price = { ...filter.price, $gte: Number(priceMin) };
  if (priceMax) filter.price = { ...filter.price, $lte: Number(priceMax) };

  try {
    const properties = await Property.find(filter);
    res.json(properties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to fetch all properties
app.get('/api/properties/all', async (req, res) => {
  try {
    const allProperties = await Property.find();
    res.json(allProperties);
  } catch (error) {
    console.error('Error fetching properties from MongoDB:', error);
    res.status(500).json({ message: 'Error fetching properties from MongoDB' });
  }
});

// New endpoint to delete a property by ID
app.delete('/api/properties/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const deletedProperty = await Property.findOneAndDelete({ post_id: postId });

    if (!deletedProperty) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json({ message: 'Property deleted successfully', deletedProperty });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ message: 'Error deleting property' });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  try {
    const propertyId = req.params.id;
    const updateData = req.body;

    console.log('Updating property:', propertyId, 'with data:', updateData);

    if (!propertyId) {
      return res.status(400).json({ message: 'Property ID is required' });
    }

    // Change this line to use post_id instead of _id
    const updatedProperty = await Property.findOneAndUpdate(
      { post_id: propertyId },
      updateData,
      { new: true }
    );

    if (!updatedProperty) {
      return res.status(404).json({ message: 'Property not found' });
    }

    console.log('Property updated successfully:', updatedProperty);
    res.json({ message: 'Property updated successfully', property: updatedProperty });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ message: 'Error updating property', error: error.message });
  }
});


// API to add a complete list with options
app.post('/api/list-options/add-complete', async (req, res) => {
  try {
    const { listName, options } = req.body;

    if (!listName || typeof listName !== 'string') {
      return res.status(400).json({ message: 'listName must be a non-empty string' });
    }

    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ message: 'options must be a non-empty array' });
    }

    // Check if the list name already exists
    let existingList = await ListOptions.findOne({ listName });

    if (existingList) {
      // If the list exists, update its options
      existingList.options = options;
      await existingList.save();
      res.status(200).json({
        message: 'List updated successfully',
        list: existingList
      });
    } else {
      // If the list doesn't exist, create a new one
      const newListOption = new ListOptions({ listName, options });
      await newListOption.save();
      res.status(201).json({
        message: 'List created successfully',
        list: newListOption
      });
    }
  } catch (error) {
    console.error('Error adding/updating list:', error);
    res.status(500).json({ message: 'Error adding/updating list', error: error.message });
  }
});

app.get('/api/list-options', async (req, res) => {
  try {
    const options = await ListOptions.find();
    res.json(options);
  } catch (error) {
    console.error('Error fetching list options:', error);
    res.status(500).json({ message: 'Error fetching list options', error: error.message });
  }
});

// Get a specific list option by listName
app.get('/api/list-options/:listName', async (req, res) => {
  try {
    const options = await ListOptions.findOne({ listName: req.params.listName });
    if (!options) {
      return res.status(404).json({ message: 'List not found' });
    }
    res.json(options);
  } catch (error) {
    console.error('Error fetching list options:', error);
    res.status(500).json({ message: 'Error fetching list options', error: error.message });
  }
});

// Create a new list option
app.post('/api/list-options', async (req, res) => {
  try {
    const newListOption = new ListOptions(req.body);
    const savedListOption = await newListOption.save();
    res.status(201).json(savedListOption);
  } catch (error) {
    console.error('Error creating list option:', error);
    res.status(400).json({ message: 'Error creating list option', error: error.message });
  }
});

// Update an existing list option
app.put('/api/list-options/:listName', async (req, res) => {
  try {
    const updatedListOption = await ListOptions.findOneAndUpdate(
      { listName: req.params.listName },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedListOption) {
      return res.status(404).json({ message: 'List not found' });
    }
    res.json(updatedListOption);
  } catch (error) {
    console.error('Error updating list option:', error);
    res.status(400).json({ message: 'Error updating list option', error: error.message });
  }
});


// Delete a list option
app.delete('/api/list-options/:listName', async (req, res) => {
  try {
    const deletedListOption = await ListOptions.findOneAndDelete({ listName: req.params.listName });
    if (!deletedListOption) {
      return res.status(404).json({ message: 'List not found' });
    }
    res.json({ message: 'List option deleted successfully' });
  } catch (error) {
    console.error('Error deleting list option:', error);
    res.status(500).json({ message: 'Error deleting list option', error: error.message });
  }
});

// Add a new option to a specific list
app.post('/api/list-options/:listName/add-option', async (req, res) => {
  try {
    const { imagelink, textview, link } = req.body;
    const updatedList = await ListOptions.findOneAndUpdate(
      { listName: req.params.listName },
      { $push: { options: { imagelink, textview, link } } },
      { new: true, runValidators: true }
    );
    if (!updatedList) {
      return res.status(404).json({ message: 'List not found' });
    }
    res.json(updatedList);
  } catch (error) {
    console.error('Error adding option to list:', error);
    res.status(400).json({ message: 'Error adding option to list', error: error.message });
  }
});

// Remove an option from a specific list
app.delete('/api/list-options/:listName/remove-option/:optionId', async (req, res) => {
  try {
    const updatedList = await ListOptions.findOneAndUpdate(
      { listName: req.params.listName },
      { $pull: { options: { _id: req.params.optionId } } },
      { new: true }
    );
    if (!updatedList) {
      return res.status(404).json({ message: 'List or option not found' });
    }
    res.json(updatedList);
  } catch (error) {
    console.error('Error removing option from list:', error);
    res.status(400).json({ message: 'Error removing option from list', error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { name, iconUrl } = req.body;
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { name, iconUrl },
      { new: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      message: 'Error updating category',
      error: error.message
    });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      message: 'Error deleting category',
      error: error.message
    });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(category);
  } catch (error) {
    console.error('Error retrieving category:', error);
    res.status(500).json({
      message: 'Error retrieving category',
      error: error.message
    });
  }
});

app.get('/api/update_gallery_all_properties', async (req, res) => {
  try {
    // Fetch all properties from the MongoDB collection
    const allProperties = await Property.find();

    // Loop through each property and update its galleryList
    for (const property of allProperties) {
      // Shuffle the image URLs array to randomize the gallery order
      const shuffledImageUrls = shuffleArray(imageUrls);
      // Update the galleryList of the property with the shuffled image URLs
      property.galleryList = shuffledImageUrls;
      // Save the updated property
      await property.save();
      console.log(`Gallery updated for property with ID ${property._id}`);
    }

    res.status(200).json({ message: 'Gallery updated for all properties' });
  } catch (error) {
    console.error('Error updating gallery for all properties:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Function to shuffle the array (Fisher-Yates shuffle algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const imageUrls = [
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhYyDh1ERCUFIPLiB2NOUxj4jykMCcttdT-mkkNxI1m440ej5DBsMM6cQcJIEBipdKwcC1_8dU47VERdFKg3b2daXuQRfBOrSnlCSldYIqrWWRwKbJqcKlSGgx7E2mpuyVGxApV-qsym3_w0jRFlkUWO8iynyMdq9vBv0GuvqhjQaT7Uu5kCZcfEPq11Q/w640-h480/Foto_72.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhw5LyhlPdcsJo5CFqc1yVKVq2i-UxaqjfwQWm7uUD9vU9FkJIJOy7tG5MF5n6-klFpMw7U2GVZLxT7LuUGjEaHJflxLBUM4zS7JlJNSixAY83gkMlZt5ONUBfcVfoJPb0fsocsTH38piot0ZHO2WXtngzcfGfkTUYF3uw8JOuokjn6XNrGJdiSz7zAeA/w640-h288/Foto_G5.jpg",
  "https://cdn6.ep.dynamics.net/s3/rw-propertyimages/40bf-H2899961-65913093__1684468222-23144-017Open2viewID557633-30HaupaNuistreet.jpg?width=1000&quality=60",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjhUp1B5P6XMm3pO9hUhLsIQ3hhrw0k1TT-e1SncEUyVENNr5GlKRBblmTl4ukWqAx0ps-6E1V4HyqSLuV5M22lmKGzb6yJrJxgjrBcLLv0CBqdX0J0jGDEVGXhVS0hSk7r14kpbYdYT8MqAMs5xBkRrJAaE70TGWFrkHfDAK-5YurpXHY64yFh6xG_Vw/w640-h426/Foto_38.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiKHCSXXolgjeUc9mTBmcBuuG3j7oFE5C7fUnlQxm_SE3bUqIvVRHgU1iVCerGZzf20OTr6w3I3CeX4s4Ekhww6jqwHbPVaHigyOolfVGrZRBUUNlAdybqVqptBc-dvYeJqeS-c-4PMtHt7-iT8rDm9d0nepzU0rzI-y_ZXiUKFdU9b48GyI09MNtrP0g/w640-h426/Foto_38.jpg"
];

app.get('/api/update_post_image/:propertyId', async (req, res) => {
  try {
    const propertyId = req.params.propertyId;

    // Array of image URLs
    const imageUrls = [
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhYyDh1ERCUFIPLiB2NOUxj4jykMCcttdT-mkkNxI1m440ej5DBsMM6cQcJIEBipdKwcC1_8dU47VERdFKg3b2daXuQRfBOrSnlCSldYIqrWWRwKbJqcKlSGgx7E2mpuyVGxApV-qsym3_w0jRFlkUWO8iynyMdq9vBv0GuvqhjQaT7Uu5kCZcfEPq11Q/w640-h480/Foto_72.jpg",
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhw5LyhlPdcsJo5CFqc1yVKVq2i-UxaqjfwQWm7uUD9vU9FkJIJOy7tG5MF5n6-klFpMw7U2GVZLxT7LuUGjEaHJflxLBUM4zS7JlJNSixAY83gkMlZt5ONUBfcVfoJPb0fsocsTH38piot0ZHO2WXtngzcfGfkTUYF3uw8JOuokjn6XNrGJdiSz7zAeA/w640-h288/Foto_G5.jpg",
      "https://cdn6.ep.dynamics.net/s3/rw-propertyimages/40bf-H2899961-65913093__1684468222-23144-017Open2viewID557633-30HaupaNuistreet.jpg?width=1000&quality=60",
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjhUp1B5P6XMm3pO9hUhLsIQ3hhrw0k1TT-e1SncEUyVENNr5GlKRBblmTl4ukWqAx0ps-6E1V4HyqSLuV5M22lmKGzb6yJrJxgjrBcLLv0CBqdX0J0jGDEVGXhVS0hSk7r14kpbYdYT8MqAMs5xBkRrJAaE70TGWFrkHfDAK-5YurpXHY64yFh6xG_Vw/w640-h426/Foto_38.jpg",
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiKHCSXXolgjeUc9mTBmcBuuG3j7oFE5C7fUnlQxm_SE3bUqIvVRHgU1iVCerGZzf20OTr6w3I3CeX4s4Ekhww6jqwHbPVaHigyOolfVGrZRBUUNlAdybqVqptBc-dvYeJqeS-c-4PMtHt7-iT8rDm9d0nepzU0rzI-y_ZXiUKFdU9b48GyI09MNtrP0g/w640-h426/Foto_38.jpg"
    ];

    // Choose a random image URL
    const randomImageUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)];

    // Find the property item by its ID
    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Update the post_image field with the randomly chosen image URL
    property.post_image = randomImageUrl;

    // Save the updated property item
    await property.save();

    res.status(200).json({ message: 'Post image updated successfully', property });
  } catch (error) {
    console.error('Error updating post image:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.get('/api/update_gallery_all_properties', async (req, res) => {
  try {
    console.log('Fetching all properties from the MongoDB collection...');
    // Fetch all properties from the MongoDB collection
    const allProperties = await Property.find();
    console.log(`Fetched ${allProperties.length} properties.`);

    // Loop through each property and update its galleryList
    for (const property of allProperties) {
      console.log(`Updating galleryList for property with ID: ${property._id}`);

      // Generate new gallery items based on the existing galleryList
      const galleryItems = property.galleryList.map((imageUrl, index) => {
        return {
          gallery_id: uuid.v4(), // Generate a unique ID for each gallery item
          gallery_image: imageUrl // Use the existing image URL as gallery_image
        };
      });

      // Update the galleryList of the property with the new format
      property.galleryList = galleryItems;

      // Save the updated property
      await property.save();
      console.log(`Gallery updated for property with ID: ${property._id}`);
    }

    // Respond with a success message
    console.log('Gallery updated for all properties.');
    res.status(200).json({ message: 'Gallery updated for all properties' });
  } catch (error) {
    console.error('Error updating gallery for all properties:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.get('/api/update_gallery_list_in_db', async (req, res) => {
  try {
    // Update all documents in the collection to rename galleryList key to gallery_list
    await Property.updateMany({}, { $rename: { "galleryList": "gallery_list" } });

    res.status(200).json({ message: 'Gallery list updated in the database' });
  } catch (error) {
    console.error('Error updating gallery list in the database:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create new carousel
app.post('/api/carousels', async (req, res) => {
  try {
    const carousel = new Carousel(req.body);
    await carousel.save();
    res.status(201).json({
      status: 'success',
      data: carousel
    });
  } catch (error) {
    if (error.code === 11000) { // Duplicate carouselId
      res.status(400).json({
        status: 'error',
        message: 'Carousel ID already exists'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
});

// Get all carousels
app.get('/api/carousels', async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;

    const carousels = await Carousel.find(filter)
      .populate('items.propertyId', 'post_title post_image price address')
      .sort('-updatedAt');

    res.json({
      status: 'success',
      data: carousels
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get single carousel
app.get('/api/carousels/:id', async (req, res) => {
  try {
    const carousel = await Carousel.findOne({
      $or: [
        { _id: req.params.id },
        { carouselId: req.params.id }
      ]
    }).populate('items.propertyId');

    if (!carousel) {
      return res.status(404).json({
        status: 'error',
        message: 'Carousel not found'
      });
    }

    res.json({
      status: 'success',
      data: carousel
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Update carousel
app.put('/api/carousels/:id', async (req, res) => {
  try {
    const carousel = await Carousel.findOneAndUpdate(
      {
        $or: [
          { _id: req.params.id },
          { carouselId: req.params.id }
        ]
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!carousel) {
      return res.status(404).json({
        status: 'error',
        message: 'Carousel not found'
      });
    }

    res.json({
      status: 'success',
      data: carousel
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Delete carousel
app.delete('/api/carousels/:id', async (req, res) => {
  try {
    const carousel = await Carousel.findOneAndDelete({
      $or: [
        { _id: req.params.id },
        { carouselId: req.params.id }
      ]
    });

    if (!carousel) {
      return res.status(404).json({
        status: 'error',
        message: 'Carousel not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Carousel deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Add item to carousel
app.post('/api/carousels/:id/items', async (req, res) => {
  try {
    const carousel = await Carousel.findOne({
      $or: [
        { _id: req.params.id },
        { carouselId: req.params.id }
      ]
    });

    if (!carousel) {
      return res.status(404).json({
        status: 'error',
        message: 'Carousel not found'
      });
    }

    carousel.items.push({
      ...req.body,
      order: carousel.items.length
    });

    await carousel.save();

    res.status(201).json({
      status: 'success',
      data: carousel
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Delete item from carousel
app.delete('/api/carousels/:carouselId/items/:itemId', async (req, res) => {
  try {
    const carousel = await Carousel.findOne({
      $or: [
        { _id: req.params.carouselId },
        { carouselId: req.params.carouselId }
      ]
    });

    if (!carousel) {
      return res.status(404).json({
        status: 'error',
        message: 'Carousel not found'
      });
    }

    const itemIndex = carousel.items.findIndex(
      item => item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Item not found'
      });
    }

    carousel.items.splice(itemIndex, 1);
    await carousel.save();

    res.json({
      status: 'success',
      message: 'Item deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Reorder carousel items
app.put('/api/carousels/:id/reorder', async (req, res) => {
  try {
    const { itemIds } = req.body;
    const carousel = await Carousel.findOne({
      $or: [
        { _id: req.params.id },
        { carouselId: req.params.id }
      ]
    });

    if (!carousel) {
      return res.status(404).json({
        status: 'error',
        message: 'Carousel not found'
      });
    }

    // Update the order of items
    itemIds.forEach((itemId, index) => {
      const item = carousel.items.id(itemId);
      if (item) {
        item.order = index;
      }
    });

    await carousel.save();

    res.json({
      status: 'success',
      data: carousel
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Update carousel status
app.patch('/api/carousels/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const carousel = await Carousel.findOneAndUpdate(
      {
        $or: [
          { _id: req.params.id },
          { carouselId: req.params.id }
        ]
      },
      { status },
      { new: true }
    );

    if (!carousel) {
      return res.status(404).json({
        status: 'error',
        message: 'Carousel not found'
      });
    }

    res.json({
      status: 'success',
      data: carousel
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Bulk update carousels
app.post('/api/carousels/bulk-update', async (req, res) => {
  try {
    const { carousels } = req.body;

    const operations = carousels.map(carousel => ({
      updateOne: {
        filter: { carouselId: carousel.carouselId },
        update: carousel,
        upsert: true
      }
    }));

    const result = await Carousel.bulkWrite(operations);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Bulk delete carousels
app.post('/api/carousels/bulk-delete', async (req, res) => {
  try {
    const { carouselIds } = req.body;

    const result = await Carousel.deleteMany({
      carouselId: { $in: carouselIds }
    });

    res.json({
      status: 'success',
      data: {
        deleted: result.deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});


// app.get('/api/buildings/:buildingId', async (req, res) => {
//   try {
//       const building = await Building.findOne({ buildingId: req.params.buildingId })
//           .populate('builder', 'name logo experience ratings')
//           .populate('project', 'name type status')
//           .populate({
//               path: 'properties',
//               select: 'post_title price type_name status',
//               options: { limit: 5 }
//           });

//       if (!building) {
//           return res.status(404).json({ error: 'Building not found' });
//       }

//       res.status(200).json(building);
//   } catch (error) {
//       console.error('Error fetching building details:', error);
//       res.status(500).json({ error: 'Error fetching building details' });
//   }
// });

// Create new building with builder reference


// AWS S3 initialization

app.post('/api/buildings/saveBuildingDetails', upload.fields([
  { name: 'galleryList', maxCount: 5 }
]), async (req, res) => {
  try {
    console.log('Received request to save building details');

    const buildingData = JSON.parse(req.body.data || '{}');
    console.log('Parsed building data:', buildingData);

    // Input validation
    if (!buildingData.buildingId || !buildingData.name) {
      return res.status(400).json({
        success: false,
        message: 'Building ID and name are required'
      });
    }

    // Upload images to S3
    const uploadedImages = [];
    if (req.files && req.files['galleryList']) {
      const files = Array.isArray(req.files['galleryList'])
        ? req.files['galleryList']
        : [req.files['galleryList']];

      console.log('Processing gallery images:', files.length);

      for (const file of files) {
        try {
          // Validate file type
          if (!file.mimetype.startsWith('image/')) {
            console.log('Skipping non-image file:', file.originalname);
            continue;
          }

          // Size validation
          const MAX_SIZE = 5 * 1024 * 1024; // 5MB
          if (file.size > MAX_SIZE) {
            console.log('Skipping large file:', file.originalname);
            continue;
          }

          const s3Params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `buildings/${buildingData.buildingId}/gallery/${uuid.v4()}-${file.originalname}`,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype,
            ACL: 'public-read'
          };

          const uploadResult = await s3.upload(s3Params).promise();
          uploadedImages.push(uploadResult.Location);
          console.log('Successfully uploaded:', uploadResult.Location);

          // Clean up temp file
          fs.unlinkSync(file.path);
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          // Continue with other files if one fails
        }
      }
    }

    // Add uploaded images to building data
    buildingData.galleryList = uploadedImages;

    // Format numeric fields
    buildingData.numberOfFlatsAvailable = parseInt(buildingData.numberOfFlatsAvailable) || 0;
    buildingData.totalFloors = parseInt(buildingData.totalFloors) || 0;

    // Format flatsDetails array
    if (Array.isArray(buildingData.flatsDetails)) {
      buildingData.flatsDetails = buildingData.flatsDetails.map(detail => ({
        floorNumber: parseInt(detail.floorNumber) || 0,
        flatsOnFloor: parseInt(detail.flatsOnFloor) || 0,
        availableFlats: parseInt(detail.availableFlats) || 0
      }));

      // Validate flats consistency
      const totalFlats = buildingData.flatsDetails.reduce((sum, floor) =>
        sum + floor.flatsOnFloor, 0);
      const totalAvailable = buildingData.flatsDetails.reduce((sum, floor) =>
        sum + floor.availableFlats, 0);

      if (totalAvailable > totalFlats) {
        return res.status(400).json({
          success: false,
          message: 'Available flats cannot exceed total flats'
        });
      }
    }

    // Format location data
    if (buildingData.location && buildingData.location.coordinates) {
      buildingData.location = {
        type: 'Point',
        coordinates: [
          parseFloat(buildingData.location.coordinates[0]),
          parseFloat(buildingData.location.coordinates[1])
        ]
      };
    }

    // Handle builder reference
    if (buildingData.builderId) {
      const builder = await Builder.findById(buildingData.builderId);
      if (!builder) {
        return res.status(404).json({
          success: false,
          message: 'Builder not found'
        });
      }
      buildingData.builder = buildingData.builderId;
    }

    // Clean up empty arrays
    if (buildingData.connectedProperties) {
      buildingData.connectedProperties = buildingData.connectedProperties
        .filter(id => id && id !== '')
        .map(id => mongoose.Types.ObjectId(id));
    }

    // Create and save building
    const newBuilding = new Building(buildingData);
    await newBuilding.save();

    // Update builder's buildings array if builder exists
    if (buildingData.builderId) {
      await Builder.findByIdAndUpdate(
        buildingData.builderId,
        {
          $addToSet: { buildings: newBuilding._id },
          $inc: { 'stats.totalBuildings': 1 }
        },
        { new: true }
      );
    }

    console.log('Building saved successfully:', newBuilding._id);

    res.status(201).json({
      success: true,
      message: 'Building saved successfully',
      data: newBuilding
    });

  } catch (error) {
    console.error('Error saving building details:', error);

    // Clean up any uploaded files in case of error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error saving building details',
      error: error.message
    });
  }
});




// app.post('/api/buildings/saveBuildingDetails', upload.fields([
//   { name: 'galleryList', maxCount: 5 }
// ]), async (req, res) => {
//   try {
//       const buildingData = JSON.parse(req.body.data || '{}');

//       // Verify builder exists
//       const builder = await Builder.findById(buildingData.builderId);
//       if (!builder) {
//           return res.status(404).json({ error: 'Builder not found' });
//       }

//       // Handle image uploads...
//       const uploadedImages = [];
//       if (req.files['galleryList']) {
//           // Your existing image upload logic...
//       }

//       buildingData.galleryList = uploadedImages;
//       buildingData.builder = buildingData.builderId;

//       const newBuilding = new Building(buildingData);
//       await newBuilding.save();

//       // Add building to builder's buildings array
//       builder.buildings.push(newBuilding._id);
//       await builder.save();

//       res.status(201).json(newBuilding);
//   } catch (error) {
//       console.error('Error saving building details:', error);
//       res.status(500).json({ error: 'Error saving building details' });
//   }
// });



app.get('/builders/:id/buildings', async (req, res) => {
  try {
    const buildings = await Building.find({ builder: req.params.id })
      .populate('project', 'name type')
      .select('name type availableFlats storey location')
      .lean();

    res.json(buildings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all properties by builder
app.get('/builders/:id/properties', async (req, res) => {
  try {
    const { type, status, priceRange } = req.query;
    const filter = { builder: req.params.id };

    if (type) filter.type_name = type;
    if (status) filter.status = status;
    if (priceRange) {
      const [min, max] = priceRange.split('-');
      filter.price = { $gte: parseInt(min), $lte: parseInt(max) };
    }

    const properties = await Property.find(filter)
      .populate('building', 'name')
      .populate('project', 'name')
      .select('post_title price type_name status location')
      .lean();

    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add building to builder
app.post('/builders/:id/buildings', async (req, res) => {
  try {
    const builder = await Builder.findById(req.params.id);
    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    const building = new Building({
      ...req.body,
      builder: req.params.id,
      buildingId: `BLD${Date.now()}`
    });

    await building.save();

    // Update builder's buildings array
    builder.buildings.push(building._id);
    await builder.save();

    res.status(201).json(building);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add property to builder
app.post('/builders/:id/properties', async (req, res) => {
  try {
    const builder = await Builder.findById(req.params.id);
    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    const property = new Property({
      ...req.body,
      builder: req.params.id,
      post_id: `PROP${Date.now()}`
    });

    await property.save();

    // Update builder's properties array
    builder.properties.push(property._id);
    await builder.save();

    res.status(201).json(property);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get builder's portfolio summary
app.get('/builders/:id/portfolio', async (req, res) => {
  try {
    const builder = await Builder.findById(req.params.id);
    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    const [buildings, properties, projects] = await Promise.all([
      Building.find({ builder: req.params.id }).select('type availableFlats'),
      Property.find({ builder: req.params.id }).select('type_name price status'),
      Project.find({ builder: req.params.id }).select('type status overview')
    ]);

    const portfolio = {
      summary: {
        totalProjects: projects.length,
        totalBuildings: buildings.length,
        totalProperties: properties.length
      },
      buildings: {
        residential: buildings.filter(b => b.type === 'residential').length,
        commercial: buildings.filter(b => b.type === 'commercial').length,
        mixed: buildings.filter(b => b.type === 'mixed').length,
        totalAvailableFlats: buildings.reduce((sum, b) => sum + parseInt(b.availableFlats || 0), 0)
      },
      properties: {
        byType: properties.reduce((acc, p) => {
          acc[p.type_name] = (acc[p.type_name] || 0) + 1;
          return acc;
        }, {}),
        byStatus: properties.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {}),
        averagePrice: properties.reduce((sum, p) => sum + p.price, 0) / properties.length
      },
      projects: {
        ongoing: projects.filter(p => p.status === 'Ongoing').length,
        completed: projects.filter(p => p.status === 'Completed').length,
        upcoming: projects.filter(p => p.status === 'Upcoming').length
      }
    };

    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update building's builder
app.put('/buildings/:buildingId/builder', async (req, res) => {
  try {
    const { newBuilderId } = req.body;

    // Verify new builder exists
    const newBuilder = await Builder.findById(newBuilderId);
    if (!newBuilder) {
      return res.status(404).json({ message: 'New builder not found' });
    }

    const building = await Building.findById(req.params.buildingId);
    if (!building) {
      return res.status(404).json({ message: 'Building not found' });
    }

    // Remove building from old builder's list
    await Builder.findByIdAndUpdate(building.builder, {
      $pull: { buildings: building._id }
    });

    // Add building to new builder's list
    await Builder.findByIdAndUpdate(newBuilderId, {
      $push: { buildings: building._id }
    });

    // Update building's builder reference
    building.builder = newBuilderId;
    await building.save();

    res.json({ message: 'Building transferred successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get all builders
app.get('/builders', async (req, res) => {
  try {
    const builders = await Builder.find()
      .select('name logo experience stats ratings')
      .lean();
    res.json(builders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get builder details by ID
app.get('/builders/:id', async (req, res) => {
  try {
    const builder = await Builder.findById(req.params.id)
      .populate({
        path: 'projects',
        select: 'name type status overview.totalUnits overview.priceRange'
      });

    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    res.json(builder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new builder
app.post('/builders', async (req, res) => {
  try {
    const builder = new Builder(req.body);
    await builder.save();
    res.status(201).json(builder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update builder
app.put('/builders/:id', async (req, res) => {
  try {
    const builder = await Builder.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    res.json(builder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete builder
app.delete('/builders/:id', async (req, res) => {
  try {
    const builder = await Builder.findByIdAndDelete(req.params.id);

    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    // Delete associated projects
    await Project.deleteMany({ builder: req.params.id });

    res.json({ message: 'Builder deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get projects by builder ID
app.get('/builders/:id/projects', async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = { builder: req.params.id };

    if (status) filter.status = status;
    if (type) filter.type = type;

    const projects = await Project.find(filter)
      .select('name type status overview location')
      .lean();

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new project to builder
app.post('/builders/:id/projects', async (req, res) => {
  try {
    const builder = await Builder.findById(req.params.id);

    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    const project = new Project({
      ...req.body,
      builder: req.params.id
    });

    await project.save();

    // Update builder stats
    builder.stats.totalProjects += 1;
    if (project.status === 'Completed') {
      builder.stats.completedProjects += 1;
    }
    builder.projects.push(project._id);
    await builder.save();

    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Search builders by location
app.get('/builders/search/location', async (req, res) => {
  try {
    const { lat, lng, radius = 10000 } = req.query; // radius in meters

    const builders = await Builder.find({
      'contact.address.location': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    })
      .select('name logo stats location')
      .lean();

    res.json(builders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get builder analytics
app.get('/builders/:id/analytics', async (req, res) => {
  try {
    const builder = await Builder.findById(req.params.id);

    if (!builder) {
      return res.status(404).json({ message: 'Builder not found' });
    }

    const projects = await Project.find({ builder: req.params.id });

    const analytics = {
      totalProjects: projects.length,
      projectsByStatus: {
        upcoming: projects.filter(p => p.status === 'Upcoming').length,
        ongoing: projects.filter(p => p.status === 'Ongoing').length,
        completed: projects.filter(p => p.status === 'Completed').length
      },
      projectsByType: {
        residential: projects.filter(p => p.type === 'Residential').length,
        commercial: projects.filter(p => p.type === 'Commercial').length,
        mixed: projects.filter(p => p.type === 'Mixed').length
      },
      ratings: builder.ratings,
      totalUnits: projects.reduce((sum, p) => sum + (p.overview.totalUnits || 0), 0)
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





// Create a new project
// app.post('/api/projects', async (req, res) => {
//   try {
//       const project = new Project({
//           ...req.body,
//           projectId: `PRJ${Date.now()}`
//       });
//       await project.save();
//       res.status(201).json(project);
//   } catch (error) {
//       res.status(400).json({ error: error.message });
//   }
// });




// Connect building to project
const connectBuildingToProject = async (req, res) => {
  try {
      const { projectId, buildingId } = req.params;

      // Validate project and building existence
      const [project, building] = await Promise.all([
          Project.findById(projectId),
          Building.findById(buildingId)
      ]);

      if (!project) {
          return res.status(404).json({ error: 'Project not found' });
      }
      if (!building) {
          return res.status(404).json({ error: 'Building not found' });
      }

      // Check if building is already connected to another project
      if (building.project && building.project.toString() !== projectId) {
          return res.status(400).json({ 
              error: 'Building is already connected to another project' 
          });
      }

      // Add building to project's connected buildings
      if (!project.connectedBuildings.includes(buildingId)) {
          project.connectedBuildings.push(buildingId);
          project.statistics.totalBuildings += 1;
      }

      // Update building with project reference
      building.project = projectId;

      // Save both documents
      await Promise.all([project.save(), building.save()]);

      res.status(200).json({
          message: 'Building connected successfully',
          project: {
              id: project._id,
              totalBuildings: project.statistics.totalBuildings
          }
      });

  } catch (error) {
      console.error('Error connecting building:', error);
      res.status(500).json({ error: 'Failed to connect building to project' });
  }
};

// Disconnect building from project
const disconnectBuildingFromProject = async (req, res) => {
  try {
      const { projectId, buildingId } = req.params;

      const [project, building] = await Promise.all([
          Project.findById(projectId),
          Building.findById(buildingId)
      ]);

      if (!project) {
          return res.status(404).json({ error: 'Project not found' });
      }
      if (!building) {
          return res.status(404).json({ error: 'Building not found' });
      }

      // Remove building from project's connected buildings
      const buildingIndex = project.connectedBuildings.indexOf(buildingId);
      if (buildingIndex > -1) {
          project.connectedBuildings.splice(buildingIndex, 1);
          project.statistics.totalBuildings -= 1;
      }

      // Remove project reference from building
      building.project = undefined;

      await Promise.all([project.save(), building.save()]);

      res.status(200).json({
          message: 'Building disconnected successfully',
          project: {
              id: project._id,
              totalBuildings: project.statistics.totalBuildings
          }
      });

  } catch (error) {
      console.error('Error disconnecting building:', error);
      res.status(500).json({ error: 'Failed to disconnect building from project' });
  }
};

// Connect property to project
const connectPropertyToProject = async (req, res) => {
  try {
      const { projectId, propertyId } = req.params;

      const [project, property] = await Promise.all([
          Project.findById(projectId),
          Property.findById(propertyId)
      ]);

      if (!project) {
          return res.status(404).json({ error: 'Project not found' });
      }
      if (!property) {
          return res.status(404).json({ error: 'Property not found' });
      }

      // Check if property is already connected to another project
      if (property.project && property.project.toString() !== projectId) {
          return res.status(400).json({ 
              error: 'Property is already connected to another project' 
          });
      }

      // Add property to project's connected properties
      if (!project.connectedProperties.includes(propertyId)) {
          project.connectedProperties.push(propertyId);
          project.statistics.totalProperties += 1;
          project.statistics.availableProperties += property.available ? 1 : 0;
      }

      // Update property with project reference
      property.project = projectId;

      await Promise.all([project.save(), property.save()]);

      res.status(200).json({
          message: 'Property connected successfully',
          project: {
              id: project._id,
              totalProperties: project.statistics.totalProperties,
              availableProperties: project.statistics.availableProperties
          }
      });

  } catch (error) {
      console.error('Error connecting property:', error);
      res.status(500).json({ error: 'Failed to connect property to project' });
  }
};

// Disconnect property from project
const disconnectPropertyFromProject = async (req, res) => {
  try {
      const { projectId, propertyId } = req.params;

      const [project, property] = await Promise.all([
          Project.findById(projectId),
          Property.findById(propertyId)
      ]);

      if (!project) {
          return res.status(404).json({ error: 'Project not found' });
      }
      if (!property) {
          return res.status(404).json({ error: 'Property not found' });
      }

      // Remove property from project's connected properties
      const propertyIndex = project.connectedProperties.indexOf(propertyId);
      if (propertyIndex > -1) {
          project.connectedProperties.splice(propertyIndex, 1);
          project.statistics.totalProperties -= 1;
          project.statistics.availableProperties -= property.available ? 1 : 0;
      }

      // Remove project reference from property
      property.project = undefined;

      await Promise.all([project.save(), property.save()]);

      res.status(200).json({
          message: 'Property disconnected successfully',
          project: {
              id: project._id,
              totalProperties: project.statistics.totalProperties,
              availableProperties: project.statistics.availableProperties
          }
      });

  } catch (error) {
      console.error('Error disconnecting property:', error);
      res.status(500).json({ error: 'Failed to disconnect property from project' });
  }
};

// Get all connected buildings for a project
const getProjectBuildings = async (req, res) => {
  try {
      const { projectId } = req.params;
      const project = await Project.findById(projectId)
          .populate('connectedBuildings', 'buildingId name totalProperties location');

      if (!project) {
          return res.status(404).json({ error: 'Project not found' });
      }

      res.status(200).json({
          projectId: project._id,
          buildings: project.connectedBuildings
      });

  } catch (error) {
      console.error('Error fetching project buildings:', error);
      res.status(500).json({ error: 'Failed to fetch project buildings' });
  }
};

// Get all connected properties for a project
const getProjectProperties = async (req, res) => {
  try {
      const { projectId } = req.params;
      const project = await Project.findById(projectId)
          .populate('connectedProperties', 'post_id post_title type_name price location');

      if (!project) {
          return res.status(404).json({ error: 'Project not found' });
      }

      res.status(200).json({
          projectId: project._id,
          properties: project.connectedProperties
      });

  } catch (error) {
      console.error('Error fetching project properties:', error);
      res.status(500).json({ error: 'Failed to fetch project properties' });
  }
};



app.post('/api/projects', upload.fields([
  { name: 'galleryList', maxCount: 10 },
  { name: 'floorPlanImages', maxCount: 10 }
]), async (req, res) => {
  try {
    console.log('Raw request body:', req.body);

    console.log('Files received:', req.files);

    let projectData;
    try {
      // Check if projectData is a string and needs parsing
         // Get project data directly from req.body since it's already parsed
     projectData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      // If parsing fails, assume it's already an object
      projectData = req.body.projectData;
    }

    console.log('Processed project data:======>>>>', projectData);

    console.log('before adding Project data:=======>>>', projectData);


    if (typeof projectData.floorPlans === 'string') {
      try {
        // Remove the concatenation artifacts and parse
        const cleanFloorPlans = projectData.floorPlans
          .replace(/\n/g, '')
          .replace(/'\s*\+\s*'/g, '')
          .replace(/\\n/g, '');
        projectData.floorPlans = JSON.parse(cleanFloorPlans);
      } catch (e) {
        console.error('Error parsing floorPlans:', e);
      }
    }

    console.log('after processing the floor plan =======>>>', projectData);


    const project = new Project(projectData);
    await project.save();

    const uploadedImages = [];
    const uploadedFloorPlanImages = [];

    // Handle gallery images
    if (req.files?.galleryList) {
      for (const file of req.files.galleryList) {
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `gallery_images/${uuid.v4()}_${file.originalname}`,
          Body: fs.createReadStream(file.path),
        };
        const result = await s3.upload(params).promise();
        uploadedImages.push(result.Location);
      }

      if (uploadedImages.length > 0) {
        project.gallery = [{
          category: 'general',
          images: uploadedImages
        }];
      }
    }

    // Handle floor plan images
    if (req.files?.floorPlanImages) {
      for (const file of req.files.floorPlanImages) {
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `floor_plan_images/${uuid.v4()}_${file.originalname}`,
          Body: fs.createReadStream(file.path),
        };
        const result = await s3.upload(params).promise();
        uploadedFloorPlanImages.push(result.Location);
      }

      // Update floor plan images if any were uploaded
      if (uploadedFloorPlanImages.length > 0) {
        project.floorPlans = project.floorPlans.map((plan, index) => ({
          ...plan.toObject(),
          image: uploadedFloorPlanImages[index] || plan.image
        }));
      }
    }

   // Save updated project with images
    if (uploadedImages.length > 0 || uploadedFloorPlanImages.length > 0) {
      await project.save();
    }


   
    // Cleanup temp files
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.existsSync(file.path) && fs.unlinkSync(file.path);
      });
    }

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    // Cleanup on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.existsSync(file.path) && fs.unlinkSync(file.path);
      });
    }
    res.status(400).json({ error: error.message });
  }
});



// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const { type, status, city } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (city) filter['location.city'] = city;

    const projects = await Project.find(filter)
      .populate('builder', 'name logo')
      .select('-__v');

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





// Get project by ID
app.get('/api/projects/:id', async (req, res) => {
  try {
    // First try to find by projectId
    let project = await Project.findOne({ projectId: req.params.id })
      .populate('builder')
      .populate('phases.buildings');

    // If not found and ID is a valid ObjectId, try finding by _id
    if (!project && mongoose.Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id)
        .populate('builder')
        .populate('phases.buildings');
    }

    if (!project) {
      console.log('Project not found with ID:', req.params.id);
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log('Found project:', project);
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update project
app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { projectId: req.params.id },
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ projectId: req.params.id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get nearby projects
app.get('/api/projects/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query; // radius in meters

    const projects = await Project.find({
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    }).populate('builder', 'name logo');

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/home-feed', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const userLocation = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    const maxDistance = 10000; // 10 km radius

    // Function to fetch nearby properties of a specific type
    const getNearbyProperties = async (typeName, limit = 5) => {
      return await Property.find({
        type_name: typeName,
        location: {
          $near: {
            $geometry: userLocation,
            $maxDistance: maxDistance
          }
        }
      })
        .limit(limit)
        .lean();
    };

    // Modified project query to be more lenient
    const getNearbyProjects = async () => {
      // First try to get projects with location data
      let projects = await Project.find({
        'location.coordinates': {
          $near: {
            $geometry: userLocation,
            $maxDistance: maxDistance
          }
        }
      })
        .populate('builder', 'name logo')
        .lean();

      console.log('Projects with location:', projects);

      // If no projects found with location, get all projects
      if (!projects || projects.length === 0) {
        projects = await Project.find({})
          .populate('builder', 'name logo')
          .lean();

        console.log('All projects:', projects);
      }

      return projects;
    };

    // Fetch all required data concurrently
    const [
      shops,
      apartments,
      warehouses,
      halls,
      allListOptions,
      nearbyProjects
    ] = await Promise.all([
      getNearbyProperties('Shops'),
      getNearbyProperties('Apartment'),
      getNearbyProperties('Warehouses'),
      getNearbyProperties('Halls'),
      ListOptions.find().lean(),
      getNearbyProjects()
    ]);



    const projectsSection = {
      sectionType: 'projectList',
      headerImage: 'https://example.com/ongoing-projects-banner.jpg',
      title: 'All Projects',
      subtitle: 'Browse All Properties',
      backgroundColor: '#ffffff',
      buttonText: 'View All Projects',
      buttonLink: 'ofo://projects',
      buttonColor: '#ff6b6b',
      projects: nearbyProjects.map(project => {
        console.log('Processing project:', {
          id: project._id,
          name: project.name,
          type: project.type,
          status: project.status,
          location: project.location?.address,
          startingPrice: project.overview?.priceRange?.min
        });

        return {
          id: project._id.toString(),
          projectId: project.projectId,
          name: project.name || 'Unnamed Project',
          type: project.type || 'Residential',
          status: project.status || 'Under Construction',
          image: project.images?.[0] || project.image || 'https://example.com/default-project.jpg',
          location: project.location?.address || project.address || '',
          builder: project.builder ? {
            name: project.builder.name || 'Unknown Builder',
            logo: project.builder.logo || null
          } : null,
          overview: {
            startingPrice: project.overview?.priceRange?.min ||
              project.overview?.startingPrice ||
              project.startingPrice || 0,
            possession: project.overview?.possessionDate ||
              project.possession ||
              'Coming Soon'
          }
        };
      }),
      viewType: 'compact'
    };

    console.log('Final projects section:', {
      totalProjects: projectsSection.projects.length,
      sectionType: projectsSection.sectionType,
      projects: projectsSection.projects
    });

    console.log('Processed projects section:', projectsSection);

    const homeFeed = [
      {
        sectionType: 'propertyList',
        headerImage: 'https://example.com/shops-banner.jpg',
        title: 'Shops near you',
        subtitle: 'Discover local stores in your area',
        backgroundColor: '#ffffff',
        buttonText: 'View All Shops',
        buttonLink: 'https://example.com/all-shops',
        buttonColor: '#ede8fe',
        properties: shops.map(shop => ({
          id: shop.post_id.toString(),
          image: shop.post_image,
          title: shop.post_title,
          subtitle: shop.address,
          price: `₹${shop.price}`,
          rating: '4.3',
          location: shop.address,
          deliveryTime: '20-25 mins',
          tags: shop.amenities?.slice(0, 3) || [],
          area: `${shop.area}`
        }))
      },
      {
        sectionType: 'propertyList',
        headerImage: 'https://example.com/apartments-banner.jpg',
        title: 'Apartments available',
        subtitle: 'Find your perfect home',
        backgroundColor: '#ffffff',
        buttonText: 'Explore Apartments',
        buttonLink: 'https://example.com/all-apartments',
        buttonColor: '#32CD32',
        properties: apartments.map(apartment => ({
          id: apartment.post_id.toString(),
          image: apartment.post_image,
          title: apartment.post_title,
          subtitle: apartment.address,
          price: `₹${apartment.price}`,
          location: apartment.address,
          area: `${apartment.area}`
        }))
      },
      // Include all ListOptions as separate sections
      ...allListOptions.map(listOption => ({
        sectionType: 'optionList',
        title: listOption.title,
        headerImage: listOption.headerImage,
        subtitle: `Browse ${listOption.listName}`,
        backgroundColor: '#ffffff',
        buttonText: `See All ${listOption.listName}`,
        buttonLink: `https://example.com/all-${listOption.listName.toLowerCase()}`,
        buttonColor: '#ffffff',
        options: listOption.options.map(option => ({
          imagelink: option.imagelink,
          textview: option.textview,
          link: option.link
        }))
      })),
      {
        projectsSection
      },
      {
        sectionType: 'propertyList',
        headerImage: 'https://example.com/warehouses-banner.jpg',
        title: 'Warehouses for rent',
        subtitle: 'Secure storage solutions',
        backgroundColor: '#ffffff',
        buttonText: 'Find Warehouses',
        buttonLink: 'https://example.com/all-warehouses',
        buttonColor: '#e8fee5',
        properties: warehouses.map(warehouse => ({
          id: warehouse.post_id.toString(),
          image: warehouse.post_image,
          title: warehouse.post_title,
          subtitle: warehouse.address,
          price: `₹${warehouse.price}`,
          location: warehouse.address,
          area: `${warehouse.area}`
        }))
      },
      {
        sectionType: 'propertyList',
        headerImage: 'https://example.com/halls-banner.jpg',
        title: 'Halls for events',
        subtitle: 'Perfect venues for your occasions',
        backgroundColor: '#ffffff',
        buttonText: 'Explore Halls',
        buttonLink: 'https://example.com/all-halls',
        buttonColor: '#ffffff',
        properties: halls.map(hall => ({
          id: hall.post_id.toString(),
          image: hall.post_image,
          title: hall.post_title,
          subtitle: hall.address,
          price: `₹${hall.price}`,
          location: hall.address,
          area: `${hall.area}`
        }))
      }
    ];

    res.json(homeFeed);
  } catch (error) {
    console.error('Error fetching home feed:', error);
    res.status(500).json({ message: 'Error fetching home feed' });
  }
});



// Add this endpoint to your existing Express app

const kanpurLocations = [
  // Arya Nagar locations
  { lat: 26.4547, lng: 80.3359, locality: 'Arya Nagar' },
  { lat: 26.4552, lng: 80.3362, locality: 'Arya Nagar' },
  { lat: 26.4542, lng: 80.3355, locality: 'Arya Nagar' },
  { lat: 26.4549, lng: 80.3365, locality: 'Arya Nagar' },
  { lat: 26.4545, lng: 80.3357, locality: 'Arya Nagar' },

  // Kakadeo locations
  { lat: 26.4655, lng: 80.3579, locality: 'Kakadeo' },
  { lat: 26.4659, lng: 80.3575, locality: 'Kakadeo' },
  { lat: 26.4652, lng: 80.3582, locality: 'Kakadeo' },
  { lat: 26.4657, lng: 80.3577, locality: 'Kakadeo' },
  { lat: 26.4654, lng: 80.3580, locality: 'Kakadeo' },

  // Civil Lines locations
  { lat: 26.4499, lng: 80.3319, locality: 'Civil Lines' },
  { lat: 26.4495, lng: 80.3315, locality: 'Civil Lines' },
  { lat: 26.4502, lng: 80.3322, locality: 'Civil Lines' },
  { lat: 26.4497, lng: 80.3317, locality: 'Civil Lines' },
  { lat: 26.4500, lng: 80.3320, locality: 'Civil Lines' },

  // Swaroop Nagar locations
  { lat: 26.4711, lng: 80.3497, locality: 'Swaroop Nagar' },
  { lat: 26.4715, lng: 80.3499, locality: 'Swaroop Nagar' },
  { lat: 26.4708, lng: 80.3495, locality: 'Swaroop Nagar' },
  { lat: 26.4713, lng: 80.3498, locality: 'Swaroop Nagar' },
  { lat: 26.4710, lng: 80.3496, locality: 'Swaroop Nagar' },

  // Tilak Nagar locations
  { lat: 26.4834, lng: 80.3119, locality: 'Tilak Nagar' },
  { lat: 26.4837, lng: 80.3122, locality: 'Tilak Nagar' },
  { lat: 26.4831, lng: 80.3117, locality: 'Tilak Nagar' },
  { lat: 26.4835, lng: 80.3120, locality: 'Tilak Nagar' },
  { lat: 26.4833, lng: 80.3118, locality: 'Tilak Nagar' }
];

const propertyImages = [
  'https://wityysaver.s3.ap-south-1.amazonaws.com/1730109159093-Screenshot%202024-10-28%20at%203.12.10%20PM.png',
  'https://wityysaver.s3.ap-south-1.amazonaws.com/1730109203974-Screenshot%202024-10-28%20at%203.11.59%20PM.png',
  'https://wityysaver.s3.ap-south-1.amazonaws.com/1730109218140-Screenshot%202024-10-28%20at%203.11.50%20PM.png'
];

const propertyTypes = ['Apartment', 'House', 'Villa', 'Commercial'];
const amenities = ['Parking', 'Lift', '24x7 Security', 'Power Backup', 'Garden', 'Gym', 'Swimming Pool'];
const furnishingOptions = ['Fully Furnished', 'Semi Furnished', 'Unfurnished'];

app.post('/api/populate-kanpur-properties', async (req, res) => {
  try {
    const properties = [];
    const numberOfProperties = Math.max(30, req.body.count || 30); // Ensure minimum 30 properties

    for (let i = 0; i < numberOfProperties; i++) {
      const locationIndex = i % kanpurLocations.length;
      const location = kanpurLocations[locationIndex];

      // Generate a random price between 55 lakhs and 3 crores (in rupees)
      const price = Math.floor(Math.random() * (30000000 - 5500000 + 1)) + 5500000;

      // Generate random area between 1000-3000 sq ft
      const area = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;

      // Calculate a realistic price per square foot
      const pricePerSqFt = Math.floor(price / area);

      // Generate random number of bedrooms (2-4)
      const bedrooms = Math.floor(Math.random() * 3) + 2;

      // Generate random number of bathrooms (bedrooms - 1 or equal to bedrooms)
      const bathrooms = bedrooms - Math.floor(Math.random() * 2);

      const property = {
        post_id: `KNP${Date.now().toString()}${i}`,
        type_name: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
        post_title: `${bedrooms} BHK ${propertyTypes[Math.floor(Math.random() * propertyTypes.length)]} for Sale in ${location.locality}`,
        post_description: `Spacious ${bedrooms} BHK property in prime location of ${location.locality}, Kanpur. Features modern amenities and excellent connectivity.`,
        address: `${location.locality}, Kanpur, Uttar Pradesh`,
        latitude: location.lat,
        longitude: location.lng,
        location: {
          type: 'Point',
          coordinates: [location.lng, location.lat]
        },
        price: price,
        pricePerSqFt: pricePerSqFt,
        area: area.toString(),
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        furnishing: furnishingOptions[Math.floor(Math.random() * furnishingOptions.length)],
        amenities: amenities.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 5) + 2),
        post_image: propertyImages[0],
        galleryList: propertyImages,
        verified: true,
        available: true,
        total_views: Math.floor(Math.random() * 1000),
        purpose: 'Buy',
        construction_status: Math.random() > 0.3 ? 'Ready to Move' : 'Under Construction',
        possession: 'Immediate',
        carpetArea: Math.floor(area * 0.75), // Carpet area is typically 75-80% of total area
        superBuiltupArea: area,
        broker_status: Math.random() > 0.5 ? 'Broker' : 'Owner',
        estimatedEMI: Math.floor((price * 0.007)), // Rough monthly EMI estimation
        transactionType: 'New Property'
      };

      properties.push(property);
    }

    // Insert all properties into the database
    await Property.insertMany(properties);

    res.status(201).json({
      message: `Successfully created ${properties.length} properties in Kanpur`,
      propertiesByLocation: properties.reduce((acc, prop) => {
        const locality = kanpurLocations.find(loc => loc.lat === prop.latitude)?.locality;
        acc[locality] = (acc[locality] || 0) + 1;
        return acc;
      }, {}),
      totalCount: properties.length
    });

  } catch (error) {
    console.error('Error populating properties:', error);
    res.status(500).json({
      message: 'Error populating properties',
      error: error.message
    });
  }
});



// Initialize the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Ensure indexes are built, especially for geospatial queries
  Property.init().then(() => console.log('Indexes are ensured, including 2dsphere'));
});