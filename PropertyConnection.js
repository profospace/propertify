// models/PropertyConnection.js
const express = require('express');

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

// routes/propertyConnections.js
const router = express.Router();
const { authenticateToken } = require('./middleware/auth');
const mongoose = require('mongoose');

// Create or update connection
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { propertyId, connectionType, metadata } = req.body;
    const userId = req.user.id;

    const connection = await PropertyConnection.findOneAndUpdate(
      { userId, propertyId, connectionType },
      { 
        $set: { metadata },
        $setOnInsert: { createdAt: new Date() }
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: connection
    });
  } catch (error) {
    console.error('Error creating/updating connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's connections
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { connectionType, status, sort = 'createdAt', page = 1, limit = 20 } = req.query;
    const query = { userId: req.user.id };

    if (connectionType) query.connectionType = connectionType;
    if (status) query.status = status;

    const connections = await PropertyConnection.find(query)
      .sort({ [sort]: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('propertyId', 'post_title post_image price location');

    const total = await PropertyConnection.countDocuments(query);

    res.status(200).json({
      success: true,
      data: connections,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update connection status
router.patch('/:connectionId', authenticateToken, async (req, res) => {
  try {
    const { status, metadata } = req.body;
    const connection = await PropertyConnection.findOneAndUpdate(
      { 
        _id: req.params.connectionId,
        userId: req.user.id
      },
      { 
        $set: { 
          status,
          metadata: { ...metadata },
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.status(200).json({
      success: true,
      data: connection
    });
  } catch (error) {
    console.error('Error updating connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete connection
router.delete('/:connectionId', authenticateToken, async (req, res) => {
  try {
    const connection = await PropertyConnection.findOneAndDelete({
      _id: req.params.connectionId,
      userId: req.user.id
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Connection deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get connection statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await PropertyConnection.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      { 
        $group: {
          _id: '$connectionType',
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.count,
          active: stat.activeCount
        };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching connection stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Get userId from JWT token
    const { connectionType, status, sort = 'createdAt', page = 1, limit = 20 } = req.query;
    
    const query = { userId };
    if (connectionType) query.connectionType = connectionType;
    if (status) query.status = status;

    const connections = await PropertyConnection.find(query)
      .sort({ [sort]: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('propertyId', 'post_title post_image price location');

    const total = await PropertyConnection.countDocuments(query);

    res.status(200).json({
      success: true,
      data: connections,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user connections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = propertyConnection;