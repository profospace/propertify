const sgMail = require('@sendgrid/mail');
const logger = require('winston');
const Property = require('./models/Property');
const User = require('./User');

class PropertyViewNotificationService {
    constructor() {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }

    async handlePropertyView(propertyId, viewerInfo) {
        try {
            // Fetch property with owner information
            const property = await Property.findOne({ post_id: propertyId })
                .populate('user_id', 'email name phone');

            if (!property) {
                logger.warn('Property not found for view alert', { propertyId });
                return;
            }

            // Get owner details
            const owner = property.user_id;
            if (!owner || !owner.email) {
                logger.warn('Owner details not found or missing email', { propertyId });
                return;
            }

            // Send email notification
            const emailContent = this.createEmailContent(property, viewerInfo);
            await this.sendEmail(owner.email, emailContent);

            // Track the view in property document
            await Property.findOneAndUpdate(
                { post_id: propertyId },
                { 
                    $push: { 
                        viewNotifications: {
                            timestamp: new Date(),
                            viewerInfo: viewerInfo,
                            notificationSent: true
                        }
                    },
                    $inc: { total_views: 1 }
                }
            );

            logger.info('Property view notification sent successfully', {
                propertyId,
                ownerEmail: owner.email
            });

        } catch (error) {
            logger.error('Failed to process property view notification', {
                error: error.message,
                propertyId,
                stack: error.stack
            });
            throw error;
        }
    }

    createEmailContent(property, viewerInfo) {
        const propertyUrl = `${process.env.WEBSITE_URL}/properties/${property.post_id}`;
        const formattedPrice = property.price?.toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR'
        });

        return {
            to: property.user_id.email,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: 'Property Alert'
            },
            subject: `New Viewer for Your Property: ${property.post_title}`,
            text: `Your property has a new viewer!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Your Property Has a New Viewer!</h2>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #2c5282;">Property Details:</h3>
                        <p><strong>Title:</strong> ${property.post_title}</p>
                        <p><strong>Location:</strong> ${property.address}</p>
                        <p><strong>Price:</strong> ${formattedPrice}</p>
                        <p><strong>Property ID:</strong> ${property.post_id}</p>
                        <p><strong>Type:</strong> ${property.type_name}</p>
                    </div>

                    <div style="background-color: #e8f4ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #2c5282;">Viewer Information:</h3>
                        <p><strong>Name:</strong> ${viewerInfo.viewerName || 'Anonymous User'}</p>
                        ${viewerInfo.viewerPhone ? `<p><strong>Phone:</strong> ${viewerInfo.viewerPhone}</p>` : ''}
                        ${viewerInfo.viewerEmail ? `<p><strong>Email:</strong> ${viewerInfo.viewerEmail}</p>` : ''}
                        <p><strong>Viewed At:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Location:</strong> ${viewerInfo.city || 'Unknown'}, ${viewerInfo.region || 'Unknown'}</p>
                        ${viewerInfo.viewerVerificationStatus?.phone ? '<p><strong>✓ Phone Verified User</strong></p>' : ''}
                    </div>

                    <div style="margin: 20px 0; text-align: center;">
                        <a href="${propertyUrl}" 
                           style="background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            View Property Details
                        </a>
                    </div>

                    <div style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
                        <p>You received this email because you have enabled property view notifications.</p>
                    </div>
                </div>
            `,
            trackingSettings: {
                clickTracking: { enable: true },
                openTracking: { enable: true }
            },
            categories: ['property-view', property.type_name?.toLowerCase()]
        };
    }

    async sendEmail(ownerEmail, emailContent) {
        try {
            await sgMail.send(emailContent);
        } catch (error) {
            logger.error('SendGrid email error', {
                error: error.message,
                ownerEmail,
                errorResponse: error.response?.body
            });
            throw error;
        }
    }
}

module.exports = PropertyViewNotificationService;