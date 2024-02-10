const express = require('express');
const properties = require('./data'); // Import the properties data

const app = express();
const PORT = process.env.PORT || 5004;

app.use(express.json());

app.get('/api/properties', (req, res) => {
    res.json(properties);
});

app.get('/api/details', (req, res) => {
    res.json(properties);
  });



  // Route for getting a specific property by ID
app.get('/api/details/:id', (req, res) => {
  const propertyId = req.params.id; // Access the ID specified in the route parameter
  const property = properties.find(detail => properties.REAL_ESTATE_APP.properties.post_id === propertyId);

  if (property) {
      res.json(property);
  } else {
      res.status(404).send('Property not found');
  }
});


// New endpoint to search for a property by id
app.get('/api/properties/:id', (req, res) => {
    const { id } = req.params; // Extract the id from request parameters
    const property = properties.REAL_ESTATE_APP.properties.find(p => p.id == id); // Find the property by id

    if (property) {
        res.json(property); // Send back the found property
    } else {
        res.status(404).send('Property not found'); // Send 404 if not found
    }
});

app.get('/api/properties/filter', (req, res) => {
    // Extract and parse query parameters


    if (!Array.isArray(properties)) {
        return res.status(500).send("Internal server error: Properties data is not an array.");
    }



    const bedrooms = req.query.bedrooms ? parseInt(req.query.bedrooms, 10) : null;
    const bathrooms = req.query.bathrooms ? parseInt(req.query.bathrooms, 10) : null;
    const purpose = req.query.purpose;
    const latitude = req.query.latitude ? parseFloat(req.query.latitude) : null;
    const longitude = req.query.longitude ? parseFloat(req.query.longitude) : null;
    const priceMin = req.query.priceMin ? parseInt(req.query.priceMin, 10) : null;
    const priceMax = req.query.priceMax ? parseInt(req.query.priceMax, 10) : null;

    // Filter properties based on the provided (and now parsed) criteria
    const filteredProperties = properties.filter(property => {
        const propertyPrice = parseInt(property.price, 10);
        
        return (
            (!bedrooms || parseInt(property.bedrooms, 10) === bedrooms) &&
            (!bathrooms || parseInt(property.bathrooms, 10) === bathrooms) &&
            (!purpose || property.purpose.toLowerCase() === purpose.toLowerCase()) &&
            (!latitude || parseFloat(property.latitude) === latitude) &&
            (!longitude || parseFloat(property.longitude) === longitude) &&
            (!priceMin || propertyPrice >= priceMin) &&
            (!priceMax || propertyPrice <= priceMax)
        );
    });

    res.json(filteredProperties);
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
