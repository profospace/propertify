const mongoose = require('mongoose');

const propertyInteractionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    propertyId: {
        type: String,
        required: true
    },
    interactionType: {
        type: String,
        enum: ['VISIT', 'SAVE', 'CONTACT'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    // Additional metadata for each interaction type
    metadata: {
        // For visits
        visitDuration: Number,
        visitType: {
            type: String,
            enum: ['VIRTUAL', 'PHYSICAL']
        },
        // For contacts
        contactMethod: {
            type: String,
            enum: ['PHONE', 'EMAIL', 'WHATSAPP']
        },
        contactStatus: {
            type: String,
            enum: ['INITIATED', 'COMPLETED', 'FAILED']
        },
        // Common fields
        deviceInfo: {
            type: String
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                default: [0, 0]
            }
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
propertyInteractionSchema.index({ userId: 1, propertyId: 1 });
propertyInteractionSchema.index({ timestamp: -1 });
propertyInteractionSchema.index({ interactionType: 1 });
propertyInteractionSchema.index({ 'metadata.location': '2dsphere' });

const PropertyInteraction = mongoose.model('PropertyInteraction', propertyInteractionSchema);
module.exports = PropertyInteraction;