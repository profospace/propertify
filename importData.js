// importData.js
require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('./models/Property'); // Ensure this path matches your file structure
const { REAL_ESTATE_APP } = require('./data.js'); // Ensure this path matches your file structure

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const importData = async () => {
    try {
        await Property.deleteMany({});
        console.log('Existing data cleared.');

        // Convert string "True"/"False" to Boolean true/false
        const formattedProperties = REAL_ESTATE_APP.properties.map(property => ({
            ...property,
            verified: property.verified === "True" // Convert "True" string to true, anything else to false
        }));

        await Property.insertMany(formattedProperties);
        console.log('Data successfully imported to MongoDB');
        process.exit();
    } catch (error) {
        console.error('Error importing data:', error);
        process.exit(1); // Exit with an error status
    }
};

// Execute the import function
importData();
