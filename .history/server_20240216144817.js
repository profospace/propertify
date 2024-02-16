const express = require('express');
const properties = require('./data'); // Import the properties data
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3012;
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

app.get('/api/details/:id', (req, res) => {
    console.log(`Fetching details for property with ID: ${req.params.id}`);
    const propertyId = req.params.id; // Access the ID specified in the route parameter

    const property = properties.REAL_ESTATE_APP.properties.find(detail => detail.post_id.toString() === propertyId);

    if (property) {
        res.json(property);
    } else {
        res.status(404).send('Property not found');
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
    const { bedrooms, bathrooms, purpose, latitude, longitude, priceMin, priceMax, radius = 0 } = req.query;
    let filter = {};
    
    // Basic attribute filters
    if (bedrooms) filter.bedrooms = Number(bedrooms);
    if (bathrooms) filter.bathrooms = Number(bathrooms);
    if (purpose) filter.purpose = purpose;
    if (priceMin) filter.price = { ...filter.price, $gte: Number(priceMin) };
    if (priceMax) filter.price = { ...filter.price, $lte: Number(priceMax) };

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
  


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
