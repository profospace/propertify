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

const PORT = process.env.PORT || 5054;
const mongoose = require('mongoose');
const Property = require('./models/Property'); // Make sure this path is correct


const util = require('util');

 //amplitude = new Amplitude('d184c07aebb3ba13b3af67456641080f')

amplitude.init('d184c07aebb3ba13b3af67456641080f');
app.use(express.json());

app.use(express.urlencoded({ extended : true }));
app.use(bodyParser.urlencoded({ extended: true}));
app.use(cors());


const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});



// Check if S3 is connected
s3.listBuckets((err, data) => {
  if (err) {
    console.error("Error connecting to AWS S3:", err);
  } else {
    console.log("Connected to AWS S3. Buckets:", data.Buckets);
  }
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







// Set up multer for file storage =====================// 


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






// Endpoint to return all properties from MongoDB =====================//


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












/// filter code ========= // 

  app.get('/api/properties/filter', async (req, res) => {
    const { bedrooms, bathrooms, purpose, latitude, longitude, priceMin, priceMax ,type_name} = req.query;
    let radius = req.query.radius ? parseFloat(req.query.radius) : 10; // Use provided radius or default to 0.5

    let filter = {};
    
    // Basic attribute filters
    if (bedrooms) {
        filter.bedrooms = Number(bedrooms);
        console.log(`Filtering by bedrooms: ${bedrooms}`);
    }
    if (bathrooms) {
        filter.bathrooms = Number(bathrooms);
        console.log(`Filtering by bathrooms: ${bathrooms}`);
    }
    if (purpose) {
        filter.purpose = purpose;
        console.log(`Filtering by purpose: ${purpose}`);
    }
    if (priceMin) {
        filter.price = { ...filter.price, $gte: Number(priceMin) };
        console.log(`Filtering with priceMin: ${priceMin}`);
    }
    if (priceMax) {
        filter.price = { ...filter.price, $lte: Number(priceMax) };
        console.log(`Filtering with priceMax: ${priceMax}`);
    }

    // Adding geospatial query if latitude and longitude are provided
    if (latitude && longitude) {
        const radiusInMeters = radius * 1000; // Convert radius to meters
        filter.location = {
            $nearSphere: {
                $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                },
                $maxDistance: radiusInMeters
            }
        };
        console.log(`Adding geospatial filter with radius: ${radius} km, latitude: ${latitude}, longitude: ${longitude}`);
    }

        // Filtering by type_name
        if (type_name) {
          filter.type_name = { $in: Array.isArray(type_name) ? type_name : [type_name] };
          console.log(`Filtering by type_name: ${type_name}`);
      }

  
    try {
        console.log('Executing property search with filter:', filter);
        let properties = await Property.find(filter);

          // Log the filtered properties
             properties.forEach(property => {
                console.log('Property:', property);
             });

        console.log(`Found ${properties.length} properties matching filter`);
        res.json(properties);
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ message: error.message });
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
    // Fetch all properties from the MongoDB collection
    const allProperties = await Property.find();

    // Loop through each property and update its galleryList
    for (const property of allProperties) {
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
    }

    // Respond with a success message
    res.status(200).json({ message: 'Gallery updated for all properties' });
  } catch (error) {
    console.error('Error updating gallery for all properties:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

  

// Initialize the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Ensure indexes are built, especially for geospatial queries
  Property.init().then(() => console.log('Indexes are ensured, including 2dsphere'));
});

