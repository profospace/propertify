const mongoose = require('mongoose');

// Define the schema for individual options
const optionSchema = new mongoose.Schema({
  imagelink: {
    type: String,
    required: true
  },
  textview: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  }
});

// Define the schema for listOptions, which includes multiple lists
const listOptionsSchema = new mongoose.Schema({
  listName: {
    type: String,
    required: true,
    unique: true
  },
  options: [optionSchema]
});

// Create the model
const ListOptions = mongoose.model('ListOptions', listOptionsSchema);

// Function to create dummy entries for multiple lists
async function createDummyEntries() {
  const dummyData = [
    {
      listName: "MainMenu",
      options: [
        { imagelink: "https://example.com/main1.jpg", textview: "Home", link: "https://example.com/home" },
        { imagelink: "https://example.com/main2.jpg", textview: "Profile", link: "https://example.com/profile" },
        { imagelink: "https://example.com/main3.jpg", textview: "Settings", link: "https://example.com/settings" }
      ]
    },
    {
      listName: "Categories",
      options: [
        { imagelink: "https://wityysaver.s3.amazonaws.com/1725277327793-ofo_(Outdoor_Banner_(96_in_x_36_in))_(2).png", textview: "Electronics", link: "https://wityysaver.s3.amazonaws.com/1725277327793-ofo_(Outdoor_Banner_(96_in_x_36_in))_(2).png" },
        { imagelink: "https://wityysaver.s3.amazonaws.com/1725277327793-ofo_(Outdoor_Banner_(96_in_x_36_in))_(2).png", textview: "OFO promotion", link: "https://wityysaver.s3.amazonaws.com/1725277327793-ofo_(Outdoor_Banner_(96_in_x_36_in))_(2).png" }

      ]
    },
    {
      listName: "QuickLinks",
      options: [
        { imagelink: "https://example.com/quick1.jpg", textview: "Today's Deals", link: "https://example.com/deals" },
        { imagelink: "https://example.com/quick2.jpg", textview: "Best Sellers", link: "https://example.com/bestsellers" }
      ]
    }
  ];

  try {
    await ListOptions.insertMany(dummyData);
    console.log('Dummy entries created successfully');
  } catch (error) {
    console.error('Error creating dummy entries:', error);
  }
}

// Call this function to populate the database with dummy entries
// createDummyEntries();

module.exports = ListOptions;