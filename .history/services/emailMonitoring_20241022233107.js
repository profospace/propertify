const EmailQueue = require('../models/emailQueue');
const User = require('../models/User');
const scheduleConfig = require('../config/emailSchedules');

class EmailMonitoringService {
  async getEmailStats(startDate, endDate) {
    const stats = await EmailQueue.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: {
            status: '$status',
            type: '$emailType'
          },
          count: { $sum: 1 },
          avgAttempts: { $avg: '$attempts' }
        }
      }
    ]);

    const deliveryRate = await this.calculateDeliveryRate(startDate, endDate);
    const bounceRate = await this.calculateBounceRate(startDate, endDate);

    return {
      stats,
      deliveryRate,
      bounceRate,
      period: { startDate, endDate }
    };
  }

  async calculateDeliveryRate(startDate, endDate) {
    const [sent, total] = await Promise.all([
      EmailQueue.countDocuments({
        status: 'sent',
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }),
      EmailQueue.countDocuments({
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      })
    ]);

    return total > 0 ? (sent / total) * 100 : 0;
  }

  async calculateBounceRate(startDate, endDate) {
    const [failed, total] = await Promise.all([
      EmailQueue.countDocuments({
        status: 'failed',
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }),
      EmailQueue.countDocuments({
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      })
    ]);

    return total > 0 ? (failed / total) * 100 : 0;
  }

  async getRecipientStats(userId) {
    return await EmailQueue.aggregate([
      { $match: { recipientId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$emailType',
          totalSent: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          totalFailed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          averageAttempts: { $avg: '$attempts' }
        }
      }
    ]);
  }

  async getFailedEmails(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [emails, total] = await Promise.all([
      EmailQueue.find({ status: 'failed' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('recipientId', 'name email'),
      EmailQueue.countDocuments({ status: 'failed' })
    ]);

    return {
      emails,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: total
      }
    };
  }
}

const emailMonitoring = new EmailMonitoringService();
module.exports = emailMonitoring;