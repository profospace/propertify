const mongoose = require('mongoose');

// Cities schema
const citiesSchema = new mongoose.Schema({
    cities: {
        type: [String], // Array of strings to store city names
        required: true,
    }
});


// Cities model
const Cities = mongoose.model('Cities', citiesSchema);

module.exports = Cities;
