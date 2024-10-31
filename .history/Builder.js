const mongoose = require('mongoose');

const builderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    logo: {
        type: String,
        trim: true
    },
    experience: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    ratings: {
        overall: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        constructionQuality: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        customerService: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        totalReviews: {
            type: Number,
            default: 0
        }
    },
    stats: {
        totalProjects: {
            type: Number,
            default: 0
        },
        completedProjects: {
            type: Number,
            default: 0
        },
        citiesPresent: {
            type: Number,
            default: 0
        }
    },
    contact: {
        email: String,
        phone: String,
        website: String,
        address: {
            street: String,
            city: String,
            state: String,
            pincode: String,
            location: {
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
        }
    },
    projects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    }],
    established: {
        type: Number,
        required: true
    },
    reraNumber: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

builderSchema.index({ 'contact.address.location': '2dsphere' });

const Builder = mongoose.model('Builder', builderSchema);
module.exports = Builder;

