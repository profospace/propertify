const express = require('express');
const properties = require('./data'); // Import the properties data
require('dotenv').config();

const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3005;
const mongoose = require('mongoose');
const Property = require('./models/Property'); // Make sure this path is correct



// MongoDB Connection
mongoose.connect('mongodb+srv://ofospace:bnmopbnmop%401010@cluster0.eb5nwll.mongodb.net/?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB connection error:", err));

  

app.use(express.json());

app.get('/api/properties', (req, res) => {
    res.json(properties);
});

app.get('/api/details', (req, res) => {
    res.json(properties);
  });


  app.get('/api/properties', (req, res) => {
    console.log("Fetching all properties");
    res.json(properties.REAL_ESTATE_APP.properties);
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
app.post('/api/addProperty', upload.fields([{ name: 'post_image', maxCount: 1 }, { name: 'floor_plan_image', maxCount: 1 }, { name: 'galleryList', maxCount: 10 }]), async (req, res) => {
  try {
    // Extract JSON data
    let propertyData = req.body;
    // Adjust paths as necessary based on your storage configuration
    if (req.files['post_image']) {
      propertyData.post_image = req.files['post_image'][0].path;
    }
    if (req.files['floor_plan_image']) {
      propertyData.floor_plan_image = req.files['floor_plan_image'][0].path;
    }
    if (req.files['galleryList']) {
      propertyData.galleryList = req.files['galleryList'].map(file => file.path);
    }

    const property = new Property(propertyData);
    await property.save();
    res.status(201).send(property);
  } catch (error) {
    res.status(400).send(error.message);
  }
});















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
    const { bedrooms, bathrooms, purpose, latitude, longitude, priceMin, priceMax, radius = 0.5 } = req.query;
    let filter = {};
    
    // Basic attribute filters
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
