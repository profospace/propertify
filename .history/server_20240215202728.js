const express = require('express');
const properties = require('./data'); // Import the properties data
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5009;
const mongoose = require('mongoose');
const Property = require('./models/Property'); // Make sure this path is correct



const uri = "mongodb+srv://ofospace:bnmopbnmop@1010@cluster0.eb5nwll.mongodb.net/?retryWrites=true&w=majority";

const client =  MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error
      await client.close();
    }
  }



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

app.get('/api/properties/filter', (req, res) => {
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


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
