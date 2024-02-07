const express = require('express');
const properties = require('./data'); // Import the properties data

const app = express();
const PORT = process.env.PORT || 5003;

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
  const property = properties.find(detail => detail.post_id === propertyId);

  if (property) {
      res.json(property);
  } else {
      res.status(404).send('Property not found');
  }
});


// New endpoint to search for a property by id
app.get('/api/properties/:id', (req, res) => {
    const { id } = req.params; // Extract the id from request parameters
    const property = properties.find(p => p.id == id); // Find the property by id

    if (property) {
        res.json(property); // Send back the found property
    } else {
        res.status(404).send('Property not found'); // Send 404 if not found
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
