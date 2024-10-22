// services/emailService.js
const sgMail = require('@sendgrid/mail');
const Analytics = require('@segment/analytics-node');
require('dotenv').config();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Initialize Segment
const analytics = new Analytics({
  writeKey: process.env.SEGMENT_WRITE_KEY
});

class EmailTrackingService {
  // Track property visit and send email
  async trackPropertyVisit(userId, propertyId, propertyDetails, userEmail) {
    try {
      // Track event in Segment
      await analytics.track({
        userId: userId.toString(),
        event: 'Property Viewed',
        properties: {
          propertyId,
          timestamp: new Date(),
          propertyType: propertyDetails.type_name,
          price: propertyDetails.price,
          location: propertyDetails.address
        }
      });

      // Send email via SendGrid
      await this.sendVisitorEmail(userEmail, propertyDetails);

      // Track email sent event
      await analytics.track({
        userId: userId.toString(),
        event: 'Property Visit Email Sent',
        properties: {
          propertyId,
          emailType: 'visit_confirmation'
        }
      });
    } catch (error) {
      console.error('Error in trackPropertyVisit:', error);
      throw error;
    }
  }

  // Send email to visitor
  async sendVisitorEmail(userEmail, propertyDetails) {
    try {
      const msg = {
        to: userEmail,
        from: process.env.SENDGRID_FROM_EMAIL,
        templateId: process.env.SENDGRID_VISITOR_TEMPLATE_ID,
        dynamicTemplateData: {
          propertyAddress: propertyDetails.address,
          propertyType: propertyDetails.type_name,
          propertyPrice: propertyDetails.price,
          propertyImage: propertyDetails.post_image
        }
      };

      await sgMail.send(msg);
    } catch (error) {
      console.error('Error sending visitor email:', error);
      throw error;
    }
  }

  // Send daily summary to property owner
  async sendOwnerSummary(ownerId, ownerEmail, properties) {
    try {
      const msg = {
        to: ownerEmail,
        from: process.env.SENDGRID_FROM_EMAIL,
        templateId: process.env.SENDGRID_OWNER_TEMPLATE_ID,
        dynamicTemplateData: {
          properties,
          date: new Date().toLocaleDateString()
        }
      };

      await sgMail.send(msg);

      // Track summary email sent
      await analytics.track({
        userId: ownerId.toString(),
        event: 'Owner Summary Email Sent',
        properties: {
          propertiesIncluded: properties.length,
          emailType: 'daily_summary'
        }
      });
    } catch (error) {
      console.error('Error sending owner summary:', error);
      throw error;
    }
  }
}

module.exports = new EmailTrackingService();

// Add this to your existing server.js file after the other imports
const emailTrackingService = require('./services/emailService');

// Modify your existing /api/details/:id endpoint
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

    // If user is authenticated and we have their email
    if (req.query.userId && req.query.userEmail) {
      await emailTrackingService.trackPropertyVisit(
        req.query.userId,
        propertyId,
        property,
        req.query.userEmail
      );
    }

    res.json(property);
  } catch (error) {
    console.error(`Error fetching property with ID ${propertyId}:`, error);
    res.status(500).send('Error fetching property details');
  }
});

// Add a new cron job for sending daily summaries to property owners
const cron = require('node-cron');

// Run at 9 PM every day
cron.schedule('0 21 * * *', async () => {
  try {
    // Get all property owners
    const owners = await User.find({ isPropertyOwner: true });

    for (const owner of owners) {
      // Get today's property visits
      const ownerProperties = await Property.find({ user_id: owner._id });
      const propertyIds = ownerProperties.map(p => p._id);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const visits = await PropertyVisit.find({
        property_id: { $in: propertyIds },
        visitTime: { $gte: todayStart }
      }).populate('property');

      if (visits.length > 0) {
        // Send summary email
        await emailTrackingService.sendOwnerSummary(
          owner._id,
          owner.email,
          visits
        );
      }
    }
  } catch (error) {
    console.error('Error processing daily summaries:', error);
  }
});