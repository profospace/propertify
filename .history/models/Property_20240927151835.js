const mongoose = require('mongoose');
// New Flat Schema
const flatSchema = new mongoose.Schema({
  floorNumber: Number,
  flatNumber: String,
  price: Number,
  flatType: String,
  flatArea: Number,
  flatBalcony: Number,
  flatBenefits: [String],
  photos: [String],
  furnishStatus: String,
  carpetArea: Number,
  superBuiltupArea: Number,
  available: Boolean
});

// Updated Property Schema
const propertySchema = new mongoose.Schema({
  // Existing fields
  post_id: String,
  type_id: String,
  user_id: String,
  building_id: String,
  type_name: String,
  max_floor:String,
  user_name: String,
  post_title: String,
  post_description: String,
  phone: String,
  address: String,
  location: {
    type: { type: String, enum: ['Point'], required: false },
    coordinates: { type: [Number], required: false }
  },
  area: String,
  anyConstraint: [Number],
  furnishing: String,
  amenities: [String],
  price: Number,
  verified: Boolean,
  post_image: String,
  floor_plan_image: String,
  total_views: Number,
  favourite: Boolean,
  
  // Updated gallery_list structure
  gallery_list: [{
    gallery_id: String,
    gallery_image: String
  }],
  
  relatedProperty: [String],
  
  // New fields
  tags: [String],
  region: String,
  construction_status: String,
  possession: String,
  broker_status: String,
  facilities: [String],
  location_advantage: [String],
  project_details: String,
  official_brochure: String,
  builder_name: String,
  builder_group: String,
  flats_available: String,
  flats_details: [flatSchema],
  bedrooms: Number,
  bathrooms: Number,
  purpose: String
}, { timestamps: true });


propertySchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Property', propertySchema);