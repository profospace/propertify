const mongoose = require('mongoose');

const builderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    company: {
        type: String,
        required: true
    },
    description: String,
    establishedYear: Number,
    contacts: [String],  // Simple list of contact numbers/emails
    logo: String,
    website: String,
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    experience: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE'
    },
    statistics: {
        completedProjects: {
            type: Number,
            default: 0
        },
        ongoingProjects: {
            type: Number,
            default: 0
        },
        totalBuildings: {
            type: Number,
            default: 0
        },
        totalProperties: {
            type: Number,
            default: 0
        }
    },
    // References to other entities
    projects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    }],
    buildings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Building'
    }],
    properties: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property'
    }],
    // Areas where the builder operates
    operatingLocations: [{
        city: String,
        state: String
    }]
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for getting all active projects
builderSchema.virtual('activeProjects', {
    ref: 'Project',
    localField: '_id',
    foreignField: 'builder',
    match: { status: 'UNDER_CONSTRUCTION' }
});

// Middleware to update statistics when referenced documents change
builderSchema.methods.updateStatistics = async function() {
    const projectCount = await mongoose.model('Project').countDocuments({ builder: this._id });
    const completedCount = await mongoose.model('Project').countDocuments({ 
        builder: this._id, 
        status: 'COMPLETED' 
    });
    const buildingCount = await mongoose.model('Building').countDocuments({ 
        builder: this._id 
    });
    const propertyCount = await mongoose.model('Property').countDocuments({ 
        builder: this._id 
    });

    this.statistics.completedProjects = completedCount;
    this.statistics.ongoingProjects = projectCount - completedCount;
    this.statistics.totalBuildings = buildingCount;
    this.statistics.totalProperties = propertyCount;

    await this.save();
};

module.exports = mongoose.model('Builder', builderSchema);