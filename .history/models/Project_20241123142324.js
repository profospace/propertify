const mongoose = require('mongoose');


const brochureSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    thumbnail: {
        type: String,
        required: true
    }
}, { _id: false });


const floorPlanSchema = new mongoose.Schema({
    name: String,
    type: String,
    bedrooms: Number,
    bathrooms: Number,
    superArea: Number,
    carpetArea: Number,
    price: Number,
    image: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const highlightSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        default: null
    }
}, { _id: false });

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
    floorPlans: {
        type: [floorPlanSchema],
        default: []
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
    brochures: {
        type: [brochureSchema],
        default: []
    },
    masterPlan: String,
    reraNumber: String,
    reraValidity: Date,
  
    paymentPlan: [{
        stage: String,
        percentage: Number,
        description: String
    }],

    nearbyLocations: [{
        type: {
            type: String,
            enum: ['EDUCATION', 'HEALTHCARE', 'SHOPPING', 'TRANSPORT', 'ENTERTAINMENT', 'BUSINESS']
        },
        name: String,
        distance: Number,  // in kilometers
        duration: Number   // in minutes
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
    highlights: {
        type: [highlightSchema],
        default: []
    },
    // Add connected buildings field
    connectedBuildings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Building'
    }],
    // Add connected properties field
    connectedProperties: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property'
    }],
    availabilityStatus: {
        type: String,
        enum: ['COMING_SOON', 'BOOKING_OPEN', 'ALMOST_SOLD_OUT', 'SOLD_OUT'],
        default: 'COMING_SOON'
    }
}, { timestamps: true });






projectSchema.index({ 'location.coordinates': '2dsphere' });
projectSchema.index({ connectedBuildings: 1 });
projectSchema.index({ connectedProperties: 1 });


projectSchema.pre('find', function(next) {
    this.populate('connectedBuildings', 'buildingId name totalProperties');
    this.populate('connectedProperties', 'post_id post_title');
    next();
});
module.exports = mongoose.model('Project', projectSchema);