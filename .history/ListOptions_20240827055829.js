const mongoose = require('mongoose');

// Define the schema for monoOptions
const listOptionsSchema = new mongoose.Schema({
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

// Create the model
const MonoOptions = mongoose.model('MonoOptions', listOptionsSchema);

// Function to create dummy entries
async function createDummyEntries() {
  const dummyData = [
    {
      imagelink: "https://example.com/image1.jpg",
      textview: "Option 1",
      link: "https://example.com/option1"
    },
    {
      imagelink: "https://example.com/image2.jpg",
      textview: "Option 2",
      link: "https://example.com/option2"
    },
    {
      imagelink: "https://example.com/image3.jpg",
      textview: "Option 3",
      link: "https://example.com/option3"
    },
    {
      imagelink: "https://example.com/image4.jpg",
      textview: "Option 4",
      link: "https://example.com/option4"
    },
    {
      imagelink: "https://example.com/image5.jpg",
      textview: "Option 5",
      link: "https://example.com/option5"
    }
  ];

  try {
    await MonoOptions.insertMany(dummyData);
    console.log('Dummy entries created successfully');
  } catch (error) {
    console.error('Error creating dummy entries:', error);
  }
}

// Call this function to populate the database with dummy entries
// createDummyEntries();

module.exports = ListOptions;