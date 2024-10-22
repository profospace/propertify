const cron = require('node-cron');
const EmailQueue = require('../models/emailQueue');
const sgMail = require('@sendgrid/mail');
const Analytics = require('@segment/analytics-node');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const analytics = new Analytics({ writeKey: process.env.SEGMENT_WRITE_KEY });

class EmailScheduler {
  constructor() {
    // Process pending emails every minute
    this.processEmailsJob = cron.schedule('* * * * *', () => {
      this.processEmails();
    });

    // Schedule daily summary emails at 9 PM
    this.dailySummaryJob = cron.schedule('0 21 * * *', () => {
      this.scheduleDailySummaries();
    });
  }

  async scheduleEmail(emailData) {
    try {
      const emailQueue = new EmailQueue({
        recipientEmail: emailData.email,
        recipientId: emailData.userId,
        emailType: emailData.type,
        scheduledFor: emailData.scheduledFor || new Date(),
        data: emailData.data
      });

      await emailQueue.save();
      console.log(`Email scheduled for ${emailData.email}`);
      
      return emailQueue;
    } catch (error) {
      console.error('Error scheduling email:', error);
      throw error;
    }
  }

  async processEmails() {
    try {
      const pendingEmails = await EmailQueue.find({
        status: 'pending',
        scheduledFor: { $lte: new Date() },
        attempts: { $lt: 3 }
      }).limit(50);

      for (const email of pendingEmails) {
        try {
          const msg = this.createEmailMessage(email);
          await sgMail.send(msg);

          email.status = 'sent';
          email.sentAt = new Date();
          await email.save();

          // Track email sent in Segment
          analytics.track({
            userId: email.recipientId.toString(),
            event: 'Email Sent',
            properties: {
              emailType: email.emailType,
              recipientEmail: email.recipientEmail
            }
          });

        } catch (error) {
          console.error(`Error sending email to ${email.recipientEmail}:`, error);
          email.attempts += 1;
          email.error = error.message;
          email.status = email.attempts >= 3 ? 'failed' : 'pending';
          await email.save();
        }
      }
    } catch (error) {
      console.error('Error processing emails:', error);
    }
  }

  createEmailMessage(emailQueue) {
    const templates = {
      property_view: process.env.SENDGRID_VISITOR_TEMPLATE_ID,
      daily_summary: process.env.SENDGRID_OWNER_TEMPLATE_ID,
      owner_alert: process.env.SENDGRID_ALERT_TEMPLATE_ID
    };

    return {
      to: emailQueue.recipientEmail,
      from: process.env.SENDGRID_FROM_EMAIL,
      templateId: templates[emailQueue.emailType],
      dynamicTemplateData: emailQueue.data
    };
  }

  async scheduleDailySummaries() {
    try {
      const owners = await User.find({ isPropertyOwner: true });

      for (const owner of owners) {
        const properties = await Property.find({ user_id: owner._id });
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const visits = await PropertyVisit.find({
          property: { $in: properties.map(p => p._id) },
          createdAt: { $gte: todayStart }
        }).populate('property');

        if (visits.length > 0) {
          await this.scheduleEmail({
            email: owner.email,
            userId: owner._id,
            type: 'daily_summary',
            data: {
              ownerName: owner.name,
              properties: visits.map(visit => ({
                propertyName: visit.property.post_title,
                address: visit.property.address,
                viewCount: visits.filter(v => v.property._id.equals(visit.property._id)).length
              }))
            }
          });
        }
      }
    } catch (error) {
      console.error('Error scheduling daily summaries:', error);
    }
  }

  async schedulePropertyViewEmail(userId, propertyId) {
    try {
      const [user, property] = await Promise.all([
        User.findById(userId),
        Property.findOne({ post_id: propertyId })
      ]);

      if (!user || !property) {
        throw new Error('User or Property not found');
      }

      await this.scheduleEmail({
        email: user.email,
        userId: user._id,
        type: 'property_view',
        data: {
          userName: user.name,
          propertyTitle: property.post_title,
          propertyAddress: property.address,
          propertyPrice: property.price,
          propertyImage: property.post_image
        }
      });

      // Also schedule an alert for the property owner
      const owner = await User.findById(property.user_id);
      if (owner) {
        await this.scheduleEmail({
          email: owner.email,
          userId: owner._id,
          type: 'owner_alert',
          data: {
            ownerName: owner.name,
            propertyTitle: property.post_title,
            viewerName: user.name,
            viewTime: new Date().toLocaleString()
          }
        });
      }
    } catch (error) {
      console.error('Error scheduling property view email:', error);
      throw error;
    }
  }
}

const emailScheduler = new EmailScheduler();
module.exports = emailScheduler;

// Add to your server.js - Modify the details endpoint
app.get('/api/details/:id', async (req, res) => {
  const clientIp = req.ip;
  const locationData = await getLocationFromIP(clientIp);
  const { city, region, country } = locationData;

  try {
    const propertyId = req.params.id;
    const property = await Property.findOne({ post_id: propertyId });

    if (!property) {
      return res.status(404).send('Property not found');
    }

    // Schedule property view email if user is authenticated
    if (req.query.userId) {
      await emailScheduler.schedulePropertyViewEmail(req.query.userId, propertyId);
    }

    // Your existing amplitude tracking
    const userId = "37827382" + propertyId;
    const eventName = 'property id';
    const eventProperties = { id: propertyId };
    await sendEventToAmplitude(userId, eventName, eventProperties);

    res.json(property);
  } catch (error) {
    console.error(`Error fetching property with ID ${propertyId}:`, error);
    res.status(500).send('Error fetching property details');
  }
});

// Add endpoints to manage email scheduling
app.post('/api/emails/schedule', async (req, res) => {
  try {
    const { email, userId, type, scheduledFor, data } = req.body;
    const scheduledEmail = await emailScheduler.scheduleEmail({
      email,
      userId,
      type,
      scheduledFor: new Date(scheduledFor),
      data
    });
    res.json(scheduledEmail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/emails/pending', async (req, res) => {
  try {
    const pendingEmails = await EmailQueue.find({
      status: 'pending'
    }).sort({ scheduledFor: 1 });
    res.json(pendingEmails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});