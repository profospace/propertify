const mongoose = require('mongoose');

const buildingData = new mongoose.Schema({
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

const buildingSchema = new mongoose.Schema({
    building: buildingData,
}, { timestamps: true });

buildingSchema.index({ 'building.location': '2dsphere' });
module.exports = mongoose.model('Building', buildingSchema);
