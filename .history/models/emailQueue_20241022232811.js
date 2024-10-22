const mongoose = require('mongoose');

const emailQueueSchema = new mongoose.Schema({
  recipientEmail: {
    type: String,
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  emailType: {
    type: String,
    enum: ['property_view', 'daily_summary', 'owner_alert'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  data: {
    type: Object,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  error: String,
  sentAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const EmailQueue = mongoose.model('EmailQueue', emailQueueSchema);
module.exports = EmailQueue;