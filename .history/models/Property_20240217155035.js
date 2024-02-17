const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  post_id: String,
  type_id: String,
  type_name: String,
  user_name: String,
  user_image: String,
  post_title: String,
  post_description: String,
  phone: String,
  address: String,
  latitude: Number,
  longitude: Number,
  purpose: String,
  bedrooms: Number,
  bathrooms: Number,
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true } // Format: [longitude, latitude]
  },
  area: String,
  furnishing: String,
  amenities: [String],
  price: Number,
  verified: Boolean,
  post_image: String,
  floor_plan_image: String,
  total_views: Number,
  favourite: Boolean,
  galleryList: [String],
  relatedProperty: [String]
}, { timestamps: true });



// Pre-save middleware to construct the location field from latitude and longitude
propertySchema.pre('save', function(next) {
  // Check if latitude and longitude are provided
  if (this.latitude && this.longitude) {
    this.location = { type: "Point", coordinates: [this.longitude, this.latitude] };
  }

  // Proceed with the save operation
  next();
});

propertySchema.index({ location: '2dsphere' }); // Applying 2dsphere index

module.exports = mongoose.model('Property', propertySchema);
