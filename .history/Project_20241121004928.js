const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    projectId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    builder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Builder'
    },
    type: {
        type: String,
        enum: ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE'],
        required: true
    },
    status: {
        type: String,
        enum: ['UPCOMING', 'UNDER_CONSTRUCTION', 'COMPLETED'],
        default: 'UNDER_CONSTRUCTION'
    },
    description: String,
    overview: {
        totalUnits: Number,
        totalTowers: Number,
        totalFloors: Number,
        launchDate: Date,
        possessionDate: Date,
        priceRange: {
            min: Number,
            max: Number,
            pricePerSqFt: Number
        }
    },
    location: {
        address: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
        coordinates: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number] // [longitude, latitude]
        }
    },
    // floorPlans: [{
    //     name: String,
    //     type: String,
    //     bedrooms: Number,
    //     bathrooms: Number,
    //     superArea: Number,
    //     carpetArea: Number,
    //     price: Number,
    //     image: String,
    //     isActive: { type: Boolean, default: true }
    // }],
    amenities: [{
        category: String,
        items: [String]
    }],
    specification: [{
        category: String,
        details: [String]
    }],
    gallery: [{
        category: String,
        images: [String]
    }],
    brochures: [{
        name: String,
        url: String
    }],
    masterPlan: String,
    reraDetails: {
        reraNumber: String,
        reraWebsite: String,
        registrationDate: Date,
        validUpto: Date
    },
    paymentPlan: [{
        stage: String,
        percentage: Number,
        description: String
    }],
    nearbyLocations: [{
        category: String,
        places: [{
            name: String,
            distance: Number,
            timeToReach: String
        }]
    }],
    phases: [{
        name: String,
        status: String,
        launchDate: Date,
        completionDate: Date,
        totalUnits: Number,
        buildings: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Building'
        }]
    }],
    highlights: [String],
    availabilityStatus: {
        type: String,
        enum: ['COMING_SOON', 'BOOKING_OPEN', 'ALMOST_SOLD_OUT', 'SOLD_OUT'],
        default: 'COMING_SOON'
    }
}, { timestamps: true });

projectSchema.index({ 'location.coordinates': '2dsphere' });
module.exports = mongoose.model('Project', projectSchema);