const mongoose = require('mongoose');

const propertyConnectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Property',
    required: true
  },
  connectionType: {
    type: String,
    enum: ['favorite', 'viewed', 'contacted', 'shortlisted'],
    required: true
  },
  metadata: {
    viewCount: { type: Number, default: 0 },
    lastViewed: Date,
    contactCount: { type: Number, default: 0 },
    lastContacted: Date,
    notes: String
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'removed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

// Compound index for efficient queries
propertyConnectionSchema.index({ userId: 1, propertyId: 1, connectionType: 1 }, { unique: true });

// Middleware to update timestamps
propertyConnectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const PropertyConnection = mongoose.model('PropertyConnection', propertyConnectionSchema);
