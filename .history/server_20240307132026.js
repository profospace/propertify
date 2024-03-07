const express = require('express');
const properties = require('./data'); // Import the properties data
require('dotenv').config();

bodyParser = require('body-parser');
const uuid = require('uuid'); // Import the uuid library
const AWS = require('aws-sdk');


const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5050;
const mongoose = require('mongoose');
const Property = require('./models/Property'); // Make sure this path is correct


const util = require('util');
app.use(express.json());


app.use(express.urlencoded({ extended : true }));
app.use(bodyParser.urlencoded({ extended: true}));


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

app.get('/api/update_properties', async (req, res) => {
  try {
      const propertiesWithoutPostId = await Property.find({ post_id: null });
      propertiesWithoutPostId.forEach(async property => {
          property.post_id = generateRandomPostId();
          await property.save();
          console.log(`Property with missing post_id updated. New post_id: ${property.post_id}`);
      });
      res.status(200).send("Properties updated successfully");
  } catch (error) {
      console.error("Error updating properties:", error);
      res.status(500).send("Internal Server Error");
  }
});



// Set up multer for file storage
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






// Endpoint to insert a new property with images
app.post('/api/upload/propertys',upload.fields([{ name: 'post_image', maxCount: 1 }, { 
  
  name: 'floor_plan_image', maxCount: 1 },{ name: 'galleryList', maxCount: 10 }]),async (req, res) => {



  console.log('Received request to upload a new property.', req.body);

  try {
    console.log(util.inspect(req.body, {showHidden: false, depth: null, colors: true}));
    console.log('data is present here data printing :: ==>> ',req.body.data)
    console.log('req.body, null sent here data printing ::',JSON.stringify(req.body, null, 2));
    const obj = JSON.parse(JSON.stringify(req.body.data)); // req.body = [Object: null prototype] { title: 'product' }
    console.log(' location found in the data sent here  obj obj obj ',obj); 
    // Extract JSON data
    let propertyData = JSON.parse(req.body.data || '{}');
    // Log received files

    console.log(' location found in the data sent here propertyData  ',propertyData); 

    console.log('Files received:', req.files['post_image']);


    const postImagePath = req.files['post_image'][0].path;
    console.log('Files propertyData   :1 =========', postImagePath);
    propertyData.post_image = postImagePath


    // Convert latitude and longitude to a GeoJSON object
    // if (propertyData.latitude && propertyData.longitude) {
    //   propertyData.location = {
    //     type: "Point",
    //     coordinates: [parseFloat(propertyData.longitude), parseFloat(propertyData.latitude)] // Note the order: [longitude, latitude]
    //   };
    // }


    propertyData.post_id =  generateRandomPostId()
    console.log('property now after location is added :: :propertyData ', propertyData);
  
    if (req.files['post_image']) {
      propertyData.post_image = req.files['post_image'][0].path;
      console.log('Post image path:', propertyData.post_image);
    }
    if (req.files['floor_plan_image']) {
      propertyData.floor_plan_image = req.files['floor_plan_image'][0].path;
      console.log('Floor plan image path:', propertyData.floor_plan_image);
    }
    if (req.files['galleryList']) {
      propertyData.galleryList = req.files['galleryList'].map(file => file.path);
      console.log('Gallery images paths:', propertyData.galleryList);
    }

    console.log('just before addition of the property property added successfully:', propertyData);


    // Create and save the new property
    const property = new Property(propertyData);
    await property.save();
    console.log('New property added successfully:', property);

    // Respond with the created property
    res.status(201).send(property);
  } catch (error) {
    console.error('Error uploading new property:', error);
    res.status(400).send(error.message);
  }
});


/// testing this end point 


// Endpoint to upload a new property with images
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
        ACL: 'public-read'
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
        ACL: 'public-read'
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
          ACL: 'public-read'
        };
        const galleryImageUploadResult = await s3.upload(galleryImageParams).promise();
        uploadedImages.push(galleryImageUploadResult.Location);
      }
    }

    // Store the uploaded image paths in the property data
    propertyData.post_image = uploadedImages[0]; // Assuming only one post image
    propertyData.floor_plan_image = uploadedImages[1]; // Assuming only one floor plan image
    propertyData.galleryList = uploadedImages.slice(2); // Assuming gallery images start from index 2

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



// Generate a random post_id
function generateRandomPostId() {
  return Math.random().toString(36).substr(2, 9);
}

// Endpoint to fetch property details by ID
app.get('/api/details/:id', async (req, res) => {
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


app.get('/api/properties/filters', (req, res) => {
    console.log("Filtering properties with query params:", req.query);

    const { bedrooms, bathrooms, purpose, latitude, longitude, priceMin, priceMax } = req.query;
    
    // This check seems redundant as properties.REAL_ESTATE_APP.properties should always be an array based on your data structure
    // if (!Array.isArray(properties.REAL_ESTATE_APP.properties)) {
    //    return res.status(500).send("Internal server error: Properties data is not an array.");
    // }

    const filteredProperties = properties.REAL_ESTATE_APP.properties.filter(property => {
        const propertyLatitude = parseFloat(property.latitude);
        const propertyLongitude = parseFloat(property.longitude);
        const propertyPrice = parseInt(property.price, 10);

        return (
            (!bedrooms || parseInt(property.bedrooms, 10) === parseInt(bedrooms, 10)) &&
            (!bathrooms || parseInt(property.bathrooms, 10) === parseInt(bathrooms, 10)) &&
            (!purpose || property.purpose.toLowerCase() === purpose.toLowerCase()) &&
            (!latitude || propertyLatitude === parseFloat(latitude)) &&
            (!longitude || propertyLongitude === parseFloat(longitude)) &&
            (!priceMin || propertyPrice >= parseInt(priceMin, 10)) &&
            (!priceMax || propertyPrice <= parseInt(priceMax, 10))
        );
    });

    console.log(`Found ${filteredProperties.length} properties matching the criteria.`);
    res.json(filteredProperties);
});


// Endpoint to return all properties from MongoDB
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



// POST endpoint to add a new property
app.post('/api/properties', async (req, res) => {
    const property = new Property(req.body);
    try {
      const savedProperty = await property.save();
      res.status(201).json(savedProperty);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });


  app.get('/api/properties/filter', async (req, res) => {
    const { bedrooms, bathrooms, purpose, latitude, longitude, priceMin, priceMax ,type_name} = req.query;
    let radius = req.query.radius ? parseFloat(req.query.radius) : 1; // Use provided radius or default to 0.5

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
        console.log(`Found ${properties.length} properties matching filter`);
        res.json(properties);
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ message: error.message });
    }
});



  
  app.get('/api/properties/filtero', async (req, res) => {
    const { bedrooms, bathrooms, purpose, latitude, longitude, priceMin, priceMax, radius = 10 } = req.query;
    let filter = {};
    
    // Basic attribute filtersa
    if (bedrooms) filter.bedrooms = Number(bedrooms);
    if (bathrooms) filter.bathrooms = Number(bathrooms);
    if (purpose) filter.purpose = purpose;
    if (priceMin) filter.price = { ...filter.price, $gte: Number(priceMin) };
    if (priceMax) filter.price = { ...filter.price, $lte: Number(priceMax) };


    console.log(`radius recieved ::  ${radius} `);
    console.log(`latitude recieved ::  ${latitude} `);

    console.log(`longitude recieved ::  ${longitude} `);



    // Adding geospatial query if latitude and longitude are provided
    if (latitude && longitude && radius > 0) {
        const radiusInMeters = parseFloat(radius) * 1000; // Convert radius to meters if needed
        filter.location = {
            $nearSphere: {
                $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                },
                $maxDistance: radiusInMeters
            }
        };
    }
  
    try {
        let properties = await Property.find(filter);
        res.json(properties);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

  // Haversine Distance Function for geospatial calculations
function haversineDistance(coords1, coords2, isMiles = false) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(coords2.latitude - coords1.latitude);
  const dLon = toRad(coords2.longitude - coords1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coords1.latitude)) * Math.cos(toRad(coords2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let distance = R * c;
  if (isMiles) distance /= 1.60934; // Convert to miles if needed
  return distance;
}
  


// Initialize the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Ensure indexes are built, especially for geospatial queries
  Property.init().then(() => console.log('Indexes are ensured, including 2dsphere'));
});

