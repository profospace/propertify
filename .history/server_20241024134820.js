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
const cors = require('cors'); // Import the cors middleware
const PORT = process.env.PORT || 5053;
const mongoose = require('mongoose');
const Property = require('./models/Property'); // Make sure this path is correct
const User = require('./User'); // Import the User model
const Building = require('./Building'); // Import the User model
const Category = require('./Category')
const constantData = require('./ConstantModel');
const ColorGradient = require('./dynamicdata');
const OTP_URL = 'https://www.fast2sms.com/dev/bulkV2';
const API_KEY = 'K6vUoBQk7gSJhVlp1tMnrPYuf2I4zeAN5FTGsHj3Z8ic9LWbDEGFPfTkcAzNQedrq6JR2mUg9h3vbV4Y';
const ListOptions = require('./ListOptions');


const util = require('util');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/') // Make sure this path exists
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname)
  }
});


const upload = multer({ storage: storage });
 //amplitude = new Amplitude('679c4c4c2055cae6b3040752ccb0470')

amplitude.init('679c4c4c2055cae6b3040752ccb0470');
app.use(express.json());

app.use(express.urlencoded({ extended : true }));
app.use(bodyParser.urlencoded({ extended: true}));
app.use(cors());


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
    return res.status(400).json({ status_code: '400', success: 'false', msg: 'Invalid phone number' });
  }

  try {
    // Check if an OTP was recently sent
    const recentOTP = await OTP.findOne({ phoneNumber, createdAt: { $gt: new Date(Date.now() - 60000) } });
    if (recentOTP) {
      return res.status(429).json({ status_code: '429', success: 'false', msg: 'Please wait before requesting a new OTP' });
    }

    // Check if the user has exceeded the daily limit (e.g., 5 OTPs per day)
    const dailyCount = await OTP.countDocuments({
      phoneNumber,
      createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    if (dailyCount >= 5) {
      return res.status(429).json({ status_code: '429', success: 'false', msg: 'Daily OTP limit exceeded. Please try again tomorrow.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    const response = await axios.get(OTP_URL, {
      params: {
        authorization: API_KEY,
        route: 'otp',
        variables_values: otp,
        numbers: phoneNumber,
        flash: '0'
      }
    });

    if (response.data.return === true) {
      await OTP.create({ phoneNumber, otp });
      res.json({ status_code: '200', success: 'true', msg: 'OTP sent successfully' });
    } else {
      res.status(400).json({ status_code: '400', success: 'false', msg: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
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
app.post('/api/verify-otp', async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !/^\d{10}$/.test(phoneNumber) || !otp || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ status_code: '400', success: 'false', msg: 'Invalid phone number or OTP' });
  }

  try {
    const otpDoc = await OTP.findOne({ phoneNumber });

    if (!otpDoc) {
      return res.status(400).json({ status_code: '400', success: 'false', msg: 'No OTP found for this number' });
    }

    // Check if 3 attempts have been made
    if (otpDoc.attempts >= 3) {
      return res.status(429).json({ status_code: '429', success: 'false', msg: 'Maximum attempts reached. Please request a new OTP.' });
    }

    // Check if enough time has passed since the last attempt (e.g., 1 minute)
    if (otpDoc.lastAttemptAt && new Date() - otpDoc.lastAttemptAt < 60000) {
      return res.status(429).json({ status_code: '429', success: 'false', msg: 'Please wait before trying again' });
    }

    // Increment attempts and update last attempt time
    otpDoc.attempts += 1;
    otpDoc.lastAttemptAt = new Date();
    await otpDoc.save();

    if (otpDoc.otp !== otp) {
      return res.status(400).json({ status_code: '400', success: 'false', msg: 'Invalid OTP' });
    }

    // OTP is valid, delete it and update user
    await OTP.deleteOne({ _id: otpDoc._id });

    // Here you might want to update the user's verified status
    await User.findOneAndUpdate({ phone: phoneNumber }, { $set: { isPhoneVerified: true } });

    res.json({ status_code: '200', success: 'true', msg: 'OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ status_code: '500', success: 'false', msg: 'Internal server error' });
  }
});

// Controller function to save user details
app.post('/api/users/saveUserDetails', async (req, res) => {
  try {
    const { name, email, socialId, loginType } = req.body;
    console.log('Received user details:', { name, email, socialId, loginType });
     _id = new mongoose.Types.ObjectId();
    const newUser = new User({_id, name, email, socialId, loginType });
    console.log('saved user details:', newUser);
    // Save the user to the database and get the generated ID
    await newUser.save();
    const userId = newUser._id;
    console.log('User details saved successfully. User ID:', userId);
        const response = {
      status_code: '200',
      success: 'true',
      msg: 'User details saved successfully',
      REAL_ESTATE_APP: {
        user_id: newUser._id, // Assuming the user ID is generated by MongoDB
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone, // Assuming phone is available in the User schema
        user_image: newUser.user_image // Assuming user_image is available in the User schema
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error saving user details:', error);
    res.status(500).json({ status_code: '500', success: 'false', msg: 'Failed to save user details' });
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

    const maxDistance = 10000; // 10 km radius, adjust as needed

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

    const shops = await getNearbyProperties('Shops');
    const apartments = await getNearbyProperties('Apartment');
    const warehouses = await getNearbyProperties('Warehouses');
    const halls = await getNearbyProperties('Halls');

    // Fetch all ListOptions
    const allListOptions = await ListOptions.find().lean();

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
          subtitle: shop.address, // Using address as subtitle
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
          subtitle: apartment.address, // Using address as subtitle
          price: `₹${apartment.price}`,
          location: apartment.address,
          area: `${apartment.area}`
        }))
      },
      // Include all ListOptions as separate sections
      ...allListOptions.map(listOption => ({
        sectionType: 'optionList',
        headerImage: 'https://example.com/list-banner.jpg', // You might want to add a default image or customize per list
        title: listOption.listName,
        subtitle: `Browse ${listOption.listName}`,
        backgroundColor: '#ffffff', // You might want to customize this per list
        buttonText: `See All ${listOption.listName}`,
        buttonLink: `https://example.com/all-${listOption.listName.toLowerCase()}`,
        buttonColor: '#ffffff', // You might want to customize this per list
        options: listOption.options.map(option => ({
          imagelink: option.imagelink,
          textview: option.textview,
          link: option.link
        }))
      })),
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
          subtitle: warehouse.address, // Using address as subtitle
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
          subtitle: hall.address, // Using address as subtitle
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


// Endpoint to fetch property details by ID ==============//


app.get('/api/details/:id', async (req, res) => {
   const clientIp = req.ip;
   const locationData = await getLocationFromIP(clientIp);
   const { city, region, country } = locationData;
   console.log('Client location:', `${city}, ${region}, ${country}`);

  const userId = "37827382"+req.params.id; // Assuming ID can be used as the user ID
  const eventName = 'property id';
  const eventProperties = { id: req.params.id };


  // Call the common function to send event data to Amplitude
  await sendEventToAmplitude(userId, eventName, eventProperties);

  console.log(`Fetching details for property with ID: ${req.params.id}`);
  const propertyId = req.params.id;

  try {
      // Use findOne to get the property document with the matching post_id
      const property = await Property.findOne({ post_id: propertyId });

      if (property) {
          res.json(property);
      } else {
          res.status(404).send('Property not found');
      }
  } catch (error) {
      console.error(`Error fetching property with ID ${propertyId}:`, error);
      res.status(500).send('Error fetching property details');
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

  try {
    // Use find to get all properties with the matching building_id
    const properties = await Property.find({ building_id: buildingId });

    if (properties.length > 0) {
      res.json(properties);
    } else {
      res.status(404).send('No properties found for the specified building ID');
    }
  } catch (error) {
    console.error(`Error fetching properties for building ID ${buildingId}:`, error);
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

app.put('/api/list-options/:listName/update-option/:optionId', async (req, res) => {
  try {
    const { listName, optionId } = req.params;
    const updatedOption = req.body;
    
    // Find the list and update the specific option
    const result = await ListOption.findOneAndUpdate(
      { listName: listName, "options._id": optionId },
      { $set: { "options.$": updatedOption } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: "List or option not found" });
    }

    res.json({ message: "Option updated successfully", updatedOption });
  } catch (error) {
    res.status(500).json({ message: "Error updating option", error: error.message });
  }
});


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
      filter.purpose = 'buy';
    } else if (purpose) {
      // If EMI parameters are not present, use the purpose provided in the query (if any)
      filter.purpose = purpose;
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






// Initialize the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Ensure indexes are built, especially for geospatial queries
  Property.init().then(() => console.log('Indexes are ensured, including 2dsphere'));
});