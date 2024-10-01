const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
    buildingId: String,
    name: String,
    frontRoad: String,
    parkingArea: String,
    description: String,
    areaUSP: String,
    ownerName: String,
    ownerId: String,
    storey: String,
    age: String,
    type: String,
    luda: String,
    totalProperties: String,
    developmentStatus: String,
    allowPreBooking: String,
    allocatedProperties: String,
    freeProperties: String,
    contactNumber: String,
    galleryList: [String],
    location: {
        type: { type: String, enum: ['Point'], required: false },
        coordinates: { type: [Number], required: false } // Format: [longitude, latitude]
    },
    // New properties
    numberOfFlatsAvailable: Number,
    totalFloors: Number,
    flatsDetails: [{
        floorNumber: Number,
        flatsOnFloor: Number,
        availableFlats: Number
    }],
    areaUSP: String,
    brochureLink: String,
    mapLink: String,
    connectedProperties: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property'
    }]
}, { timestamps: true });

buildingSchema.index({ 'building.location': '2dsphere' });
module.exports = mongoose.model('Building', buildingSchema);