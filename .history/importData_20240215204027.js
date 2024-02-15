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
        // Optional: Clear the collection before import to avoid duplicates
        await Property.deleteMany({});
        console.log('Existing data cleared.');

        // Insert sample data into the database
        await Property.insertMany(REAL_ESTATE_APP.properties);
        console.log('Data successfully imported to MongoDB');

        // Exit the process when complete
        process.exit();
    } catch (error) {
        console.error('Error importing data:', error);
        process.exit(1); // Exit with error
    }
};

// Execute the import function
importData();
