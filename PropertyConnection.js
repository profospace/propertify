const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authenticateToken } = require('./middleware/auth');

// Schema Definition
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
    viewCount: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    lastViewed: Date,
    contactCount: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    lastContacted: Date,
    notes: {
      type: String,
      maxLength: 1000
    }
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'removed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
propertyConnectionSchema.index(
  { userId: 1, propertyId: 1, connectionType: 1 }, 
  { unique: true }
);
propertyConnectionSchema.index({ userId: 1, status: 1 });
propertyConnectionSchema.index({ userId: 1, connectionType: 1 });

// Schema Methods
propertyConnectionSchema.pre('save', function(next) {
  if (this.metadata) {
    if (this.metadata.viewCount < 0) this.metadata.viewCount = 0;
    if (this.metadata.contactCount < 0) this.metadata.contactCount = 0;
    if (this.metadata.notes) {
      this.metadata.notes = this.metadata.notes.slice(0, 1000);
    }
  }
  next();
});

propertyConnectionSchema.methods.updateMetadata = function(newMetadata) {
  if (!newMetadata) return;
  
  const metadata = this.metadata || {};
  
  if (newMetadata.viewCount !== undefined) {
    metadata.viewCount = Math.max(0, newMetadata.viewCount);
  }
  if (newMetadata.contactCount !== undefined) {
    metadata.contactCount = Math.max(0, newMetadata.contactCount);
  }
  if (newMetadata.notes !== undefined) {
    metadata.notes = newMetadata.notes.slice(0, 1000);
  }
  if (newMetadata.lastViewed) {
    metadata.lastViewed = new Date(newMetadata.lastViewed);
  }
  if (newMetadata.lastContacted) {
    metadata.lastContacted = new Date(newMetadata.lastContacted);
  }
  
  this.metadata = metadata;
};

// Model creation
const PropertyConnection = mongoose.model('PropertyConnection', propertyConnectionSchema);

// Validation Middleware
const validateConnection = (req, res, next) => {
  const { propertyId, connectionType } = req.body;
  
  if (!propertyId || !connectionType) {
    return res.status(400).json({
      success: false,
      error: 'PropertyId and connectionType are required'
    });
  }

  if (!['favorite', 'viewed', 'contacted', 'shortlisted'].includes(connectionType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid connection type'
    });
  }

  next();
};

// Routes
router.post('/', authenticateToken, validateConnection, async (req, res) => {
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

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { connectionType, status, sort = 'createdAt', page = 1, limit = 20 } = req.query;
    const allowedSortFields = ['createdAt', 'updatedAt'];
    
    if (sort && !allowedSortFields.includes(sort)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sort field'
      });
    }

    const query = { userId: req.user.id };
    if (connectionType) query.connectionType = connectionType;
    if (status) query.status = status;

    const [connections, total] = await Promise.all([
      PropertyConnection.find(query)
        .sort({ [sort]: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('propertyId', 'post_title post_image price location'),
      PropertyConnection.countDocuments(query)
    ]);

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

router.patch('/:connectionId', authenticateToken, async (req, res) => {
  try {
    const { status, metadata } = req.body;
    const connection = await PropertyConnection.findOne({
      _id: req.params.connectionId,
      userId: req.user.id
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    if (status) {
      if (!['active', 'archived', 'removed'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
      }
      connection.status = status;
    }

    if (metadata) {
      connection.updateMetadata(metadata);
    }

    await connection.save();

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

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await PropertyConnection.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(req.user.id) 
        } 
      },
      { 
        $group: {
          _id: '$connectionType',
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
            }
          },
          totalViews: { 
            $sum: '$metadata.viewCount' 
          },
          totalContacts: { 
            $sum: '$metadata.contactCount' 
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.count,
          active: stat.activeCount,
          totalViews: stat.totalViews,
          totalContacts: stat.totalContacts
        };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;