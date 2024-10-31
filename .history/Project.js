// models/Project.js
const projectSchema = new mongoose.Schema({
    builder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Builder',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['Residential', 'Commercial', 'Mixed'],
        required: true
    },
    status: {
        type: String,
        enum: ['Upcoming', 'Ongoing', 'Completed'],
        required: true
    },
    overview: {
        totalArea: String,
        totalUnits: Number,
        totalBuildings: Number,
        configurationTypes: [String],
        priceRange: {
            min: Number,
            max: Number,
            unit: {
                type: String,
                enum: ['Lac', 'Cr']
            }
        },
        possessionDate: Date
    },
    location: {
        address: {
            street: String,
            city: String,
            state: String,
            pincode: String,
            landmark: String
        },
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                required: true
            }
        }
    },
    buildings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Building'
    }],
    properties: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property'
    }],
    specifications: {
        structure: String,
        walls: String,
        flooring: String,
        doors: String,
        windows: String,
        electricals: String,
        security: String
    },
    amenities: [String],
    gallery: [{
        url: String,
        type: {
            type: String,
            enum: ['image', 'video']
        },
        caption: String
    }],
    documents: [{
        title: String,
        url: String,
        type: String
    }],
    highlights: [String],
    reraInfo: {
        number: String,
        registeredDate: Date,
        validUntil: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

projectSchema.index({ 'location.coordinates': '2dsphere' });

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;