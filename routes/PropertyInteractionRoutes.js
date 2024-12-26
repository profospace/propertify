const express = require('express')
const router = express.Router()
const PropertyInteraction = require("../models/PropertyInteraction");
const Property = require('../models/Property');
const mixpanel = require('mixpanel');
const { authenticateToken } = require('../middleware/auth');
const mixpanelClient = mixpanel.init('79ff92f256ca2a109638e7812a849f54');
const User = require('../User'); // Import the User model
// Initialize Mixpanel with your token
// Add authentication middleware for all routes
// router.use(authenticateToken);


// router.use(authenticateToken);
router.post('/api/interactions', authenticateToken, async (req, res) => {
    console.log("Ineration stared")
    try {
        const userId = req.user.id;
        const userDetails = await User.findById(req.user.id);
        if (userDetails) {
            console.log('\n========== USER DETAILS ==========');
            console.log('Basic Information:');
            console.log('- ID:', userId);
            console.log('- Name:', userDetails.name);
            console.log('- Email:', userDetails.email);
            console.log('- Phone:', userDetails.phone);
            console.log('- Created:', userDetails.createdAt);
            console.log('- Login Type:', userDetails.loginType);
            console.log('- Last Login:', userDetails.lastLogin);
        
            console.log('\nVerification Status:');
            console.log('- Phone Verified:', userDetails.isPhoneVerified);
            console.log('- Email Verified:', userDetails.verificationStatus?.email);
            console.log('- Government Verified:', userDetails.verificationStatus?.government);
        
            console.log('\nProfile Details:');
            console.log('- Gender:', userDetails.profile?.gender);
            console.log('- Date of Birth:', userDetails.profile?.dateOfBirth);
            console.log('- Avatar:', userDetails.profile?.avatar);
        
            if (userDetails.profile?.addressDetails) {
                console.log('\nAddress:');
                console.log('- Street:', userDetails.profile.addressDetails.street);
                console.log('- City:', userDetails.profile.addressDetails.city);
                console.log('- State:', userDetails.profile.addressDetails.state);
                console.log('- Country:', userDetails.profile.addressDetails.country);
                console.log('- Pincode:', userDetails.profile.addressDetails.pincode);
            }
        
            if (userDetails.profile?.preferences) {
                console.log('\nPreferences:');
                console.log('- Property Types:', userDetails.profile.preferences.propertyTypes);
                console.log('- Price Range:', userDetails.profile.preferences.priceRange);
                console.log('- Preferred Locations:', userDetails.profile.preferences.preferredLocations);
                console.log('- Amenities:', userDetails.profile.preferences.amenities);
                console.log('- Property Size:', userDetails.profile.preferences.propertySize);
            }
        
            console.log('\nActivity Counts:');
            console.log('- Viewed Properties:', userDetails.history?.viewedProperties?.length || 0);
            console.log('- Liked Properties:', userDetails.history?.likedProperties?.length || 0);
            console.log('- Contacted Properties:', userDetails.history?.contactedProperties?.length || 0);
            console.log('- Search History Count:', userDetails.history?.searchHistory?.length || 0);
            console.log('- Saved Properties:', userDetails.savedProperties?.length || 0);
            console.log('- Saved Searches:', userDetails.savedSearches?.length || 0);
            console.log('- EMI Calculations:', userDetails.emiCalculations?.length || 0);
        
            if (userDetails.profile?.notifications) {
                console.log('\nNotification Settings:');
                console.log('- Email:', userDetails.profile.notifications.email);
                console.log('- Push:', userDetails.profile.notifications.push);
                console.log('- Price Alerts:', userDetails.profile.notifications.priceAlerts);
                console.log('- Saved Search Alerts:', userDetails.profile.notifications.savedSearchAlerts);
                console.log('- SMS:', userDetails.profile.notifications.smsNotifications);
            }
        
            // Format data for Mixpanel
            const address = userDetails.profile?.addressDetails;
            const formattedAddress = address ? 
                `${address.street || ''}, ${address.city || ''}, ${address.state || ''}, ${address.pincode || ''}`.trim() : '';
        
            const preferences = userDetails.profile?.preferences || {};
            const priceRange = preferences.priceRange ? 
                `${preferences.priceRange.min || 0} - ${preferences.priceRange.max || 0}` : '';
        
            const mixpanelData = {
                $email: userDetails.email,
                $name: userDetails.name,
                $phone: userDetails.phone,
                $created: userDetails.createdAt,
                last_login: userDetails.lastLogin || new Date().toISOString(),
                login_type: userDetails.loginType,
                is_phone_verified: userDetails.isPhoneVerified,
                email_verified: userDetails.verificationStatus?.email,
                government_verified: userDetails.verificationStatus?.government,
                gender: userDetails.profile?.gender,
                date_of_birth: userDetails.profile?.dateOfBirth,
                address: formattedAddress,
                avatar: userDetails.profile?.avatar,
                preferred_property_types: preferences.propertyTypes || [],
                preferred_locations: preferences.preferredLocations || [],
                preferred_amenities: preferences.amenities || [],
                price_range: priceRange,
                property_size_range: preferences.propertySize ? 
                    `${preferences.propertySize.min || 0} - ${preferences.propertySize.max || 0} ${preferences.propertySize.unit || 'sq.ft'}` : '',
                properties_viewed: userDetails.history?.viewedProperties?.length || 0,
                properties_liked: userDetails.history?.likedProperties?.length || 0,
                properties_contacted: userDetails.history?.contactedProperties?.length || 0,
                search_count: userDetails.history?.searchHistory?.length || 0,
                saved_searches_count: userDetails.savedSearches?.length || 0,
                saved_properties_count: userDetails.savedProperties?.length || 0,
                emi_calculations_count: userDetails.emiCalculations?.length || 0,
                email_notifications: userDetails.profile?.notifications?.email,
                push_notifications: userDetails.profile?.notifications?.push,
                price_alerts: userDetails.profile?.notifications?.priceAlerts,
                saved_search_alerts: userDetails.profile?.notifications?.savedSearchAlerts,
                sms_notifications: userDetails.profile?.notifications?.smsNotifications,
                last_property_view: userDetails.history?.viewedProperties?.[0]?.timestamp,
                last_property_contact: userDetails.history?.contactedProperties?.[0]?.timestamp,
                last_search: userDetails.history?.searchHistory?.[0]?.timestamp,
                last_updated: new Date().toISOString()
            };
        
            console.log('\n========== MIXPANEL DATA ==========');
            console.log(JSON.stringify(mixpanelData, null, 2));
        
            // Set Mixpanel profile
            mixpanelClient.people.set(userId, mixpanelData);
            console.log('\nMixpanel profile updated successfully');
            console.log('====================================\n');
        } else {
            console.log('\n❌ User details not found for ID:', userId);
        }



        console.log("user id received here " + userId)
        const {
            propertyId,
            interactionType,
            incrementBy,
            metadata
        } = req.body;
        console.log("property", propertyId)

        const interaction = new PropertyInteraction({
            userId: req.user.id,
            propertyId,
            interactionType,
            phoneNumber: userDetails.phone, // Add phone number from user details
            email:userDetails.email,
            location: {  // Add location from user's address details
                address: userDetails.profile?.addressDetails?.street || '',
                city: userDetails.profile?.addressDetails?.city || '',
                state: userDetails.profile?.addressDetails?.state || '',
                country: userDetails.profile?.addressDetails?.country || '',
                pincode: userDetails.profile?.addressDetails?.pincode || '',
                coordinates: metadata?.coordinates || [0, 0]
            },
            metadata: {
                ...metadata,
                timestamp: new Date()
            }
        });

        await interaction.save();

        console.log('interaction', interaction)


        // Send the interaction data to Mixpanel
        mixpanelClient.track('Property Interaction', {
            distinct_id: req.user.id, // Use the user ID to uniquely identify the user
            property_id: propertyId,
            interaction_type: interactionType,
            metadata: metadata, // Include metadata (e.g., visitDuration, etc.)
            timestamp: new Date().toISOString()
        });

        if (interactionType === 'VISIT') {
            console.log("property", propertyId)

            const property = await Property.findOneAndUpdate(
                { post_id: propertyId },  // Changed to match schema
                { $inc: { visted: incrementBy || 1 } },
                { new: true, runValidators: true }
            );
            console.log("property id sent", propertyId)

            console.log("property found out == == >>> ", property.post_title)


            await User.findByIdAndUpdate(req.user.id, {
                $push: {
                    'history.viewedProperties': {
                        propertyId,
                        timestamp: new Date(),
                        timeSpent: metadata?.visitDuration
                    }
                }

            })
            mixpanelClient.track('Property Visit', {
                distinct_id: req.user.id,
                property_id: propertyId,
                visit_duration: metadata?.visitDuration || 0,
                timestamp: new Date().toISOString()
            });
        } 

        //79ff92f256ca2a109638e7812a849f54
        // Update user's history in User model if needed
        // if (interactionType === 'VISIT') {
        //     await User.findByIdAndUpdate(req.user.id, {
        //         $push: {
        //             'history.viewedProperties': {
        //                 propertyId,
        //                 timestamp: new Date(),
        //                 timeSpent: metadata?.visitDuration
        //             }
        //         }
        //     });
        // }
    
        res.status(201).json({
            success: true,
            message: 'Interaction recorded successfully',
            data: interaction
        });

    } catch (error) {
        console.error('Error recording interaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record interaction',
            error: error.message
        });
    }
    
});


// API to get interaction statistics for dashboard
router.get('/api/interactions/stats', async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            propertyId,
            interactionType
        } = req.query;
 
        const query = {};
        console.log(req.query)
 
        // Add date range filter if provided
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
 
        // Add property filter if provided
        if (propertyId) query.propertyId = propertyId;
 
        // Add interaction type filter if provided
        if (interactionType) query.interactionType = interactionType;
 
        // Get interactions with user details
        const interactions = await PropertyInteraction.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $addFields: {
                    formattedLocation: {
                        $concat: [
                            { $ifNull: ['$location.address', ''] },
                            { $cond: [{ $ifNull: ['$location.city', false] }, ', ', ''] },
                            { $ifNull: ['$location.city', ''] },
                            { $cond: [{ $ifNull: ['$location.state', false] }, ', ', ''] },
                            { $ifNull: ['$location.state', ''] },
                            { $cond: [{ $ifNull: ['$location.country', false] }, ', ', ''] },
                            { $ifNull: ['$location.country', ''] },
                            { $cond: [{ $ifNull: ['$location.pincode', false] }, ' - ', ''] },
                            { $ifNull: ['$location.pincode', ''] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        propertyId: '$propertyId',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    interactions: {
                        $push: {
                            type: '$interactionType',
                            timestamp: '$timestamp',
                            metadata: '$metadata',
                            phoneNumber: '$phoneNumber',
                            email: '$email',
                            location: {
                                formatted: '$formattedLocation',
                                details: '$location'
                            },
                            user: {
                                name: '$user.name'
                            }
                        }
                    },
                    totalVisits: {
                        $sum: { $cond: [{ $eq: ['$interactionType', 'VISIT'] }, 1, 0] }
                    },
                    totalSaves: {
                        $sum: { $cond: [{ $eq: ['$interactionType', 'SAVE'] }, 1, 0] }
                    },
                    totalContacts: {
                        $sum: { $cond: [{ $eq: ['$interactionType', 'CONTACT'] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.date': -1 }
            }
        ]);
 
        console.log("interactions B", interactions)
 
        // Format response for the dashboard
        const formattedResponse = interactions.map(item => ({
            propertyId: item._id.propertyId,
            date: item._id.date,
            stats: {
                visits: item.totalVisits,
                saves: item.totalSaves,
                contacts: item.totalContacts
            },
            details: item.interactions.map(interaction => ({
                type: interaction.type,
                timestamp: interaction.timestamp,
                userName: interaction.user.name,
                contactInfo: {
                    phoneNumber: interaction.phoneNumber,
                    email: interaction.email
                },
                location: interaction.location,
                metadata: {
                    visitDuration: interaction.metadata?.visitDuration,
                    visitType: interaction.metadata?.visitType,
                    contactMethod: interaction.metadata?.contactMethod,
                    contactStatus: interaction.metadata?.contactStatus,
                    deviceInfo: interaction.metadata?.deviceInfo,
                    location: interaction.metadata?.location
                }
            }))
        }));
 
        res.json({
            success: true,
            data: formattedResponse
        });
 
    } catch (error) {
        console.error('Error fetching interaction stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch interaction statistics',
            error: error.message
        });
    }
 });

// API to get detailed interactions for a specific property
router.get('/api/interactions/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { date } = req.query;

        const query = {
            propertyId
        };

        // Add date filter if provided
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            query.timestamp = {
                $gte: startDate,
                $lt: endDate
            };
        }

        const interactions = await PropertyInteraction.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    interactionType: 1,
                    timestamp: 1,
                    metadata: 1,
                    phoneNumber: 1,
                    email: 1,
                    location: 1,
                    'user.name': 1
                }
            },
            {
                $addFields: {
                    formattedLocation: {
                        $concat: [
                            { $ifNull: ['$location.address', ''] },
                            { $cond: [{ $ifNull: ['$location.city', false] }, ', ', ''] },
                            { $ifNull: ['$location.city', ''] },
                            { $cond: [{ $ifNull: ['$location.state', false] }, ', ', ''] },
                            { $ifNull: ['$location.state', ''] },
                            { $cond: [{ $ifNull: ['$location.country', false] }, ', ', ''] },
                            { $ifNull: ['$location.country', ''] },
                            { $cond: [{ $ifNull: ['$location.pincode', false] }, ' - ', ''] },
                            { $ifNull: ['$location.pincode', ''] }
                        ]
                    }
                }
            },
            { $sort: { timestamp: -1 } }
        ]);

        // Format the response data
        const formattedInteractions = interactions.map(interaction => ({
            id: interaction._id,
            type: interaction.interactionType,
            timestamp: interaction.timestamp,
            userName: interaction.user.name,
            contactInfo: {
                phoneNumber: interaction.phoneNumber,
                email: interaction.email
            },
            location: {
                formatted: interaction.formattedLocation,
                details: {
                    address: interaction.location.address,
                    city: interaction.location.city,
                    state: interaction.location.state,
                    country: interaction.location.country,
                    pincode: interaction.location.pincode,
                    coordinates: interaction.location.coordinates
                }
            },
            metadata: {
                visitDuration: interaction.metadata?.visitDuration,
                visitType: interaction.metadata?.visitType,
                contactMethod: interaction.metadata?.contactMethod,
                contactStatus: interaction.metadata?.contactStatus,
                deviceInfo: interaction.metadata?.deviceInfo,
                location: interaction.metadata?.location
            }
        }));

        res.json({
            success: true,
            count: formattedInteractions.length,
            data: formattedInteractions
        });

    } catch (error) {
        console.error('Error fetching property interactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch property interactions',
            error: error.message
        });
    }
});

module.exports = router;