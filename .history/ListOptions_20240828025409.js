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
        { imagelink: "https://example.com/cat1.jpg", textview: "Electronics", link: "https://example.com/electronics" },
        { imagelink: "https://example.com/cat2.jpg", textview: "Clothing", link: "https://example.com/clothing" },
        { imagelink: "https://example.com/cat3.jpg", textview: "Books", link: "https://example.com/books" },
        { imagelink: "https://example.com/cat4.jpg", textview: "Sports", link: "https://example.com/sports" }
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