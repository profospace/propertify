const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
    buildingId: String,
    name: String,
    frontRoad: String,
    parkingArea: String,
    galleryList: [String],
    location: {
        type: { type: String, enum: ['Point'], required: false },
        coordinates: { type: [Number], required: false } // Format: [longitude, latitude]
    }
}, { timestamps: true });

buildingSchema.index({ 'building.location': '2dsphere' });
module.exports = mongoose.model('Building', buildingSchema);
