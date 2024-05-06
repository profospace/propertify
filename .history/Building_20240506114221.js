const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
    buildingId: String,
    name: String,
    location: String,
    frontRoad: String,
    parkingArea: String,
    photos: [String],
    location: {
        type: { type: String, enum: ['Point'], required: false },
        coordinates: { type: [Number], required: false } // Format: [longitude, latitude]
    }
});

const propertySchema = new mongoose.Schema({
    building: buildingSchema,
    // Any other fields you want to include directly in the Property schema
}, { timestamps: true });

propertySchema.index({ 'building.location': '2dsphere' });
module.exports = mongoose.model('Property', propertySchema);
