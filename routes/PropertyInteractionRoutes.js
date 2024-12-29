const express = require('express')
const router = express.Router()
const PropertyInteraction = require("../models/PropertyInteraction");
const Property = require('../models/Property');
const mixpanel = require('mixpanel');
const { authenticateToken } = require('../middleware/auth');
const mixpanelClient = mixpanel.init('79ff92f256ca2a109638e7812a849f54');
// Initialize Mixpanel with your token
// Add authentication middleware for all routes
// router.use(authenticateToken);


// router.use(authenticateToken);
router.post('/api/interactions', authenticateToken, async (req, res) => {
    console.log("Ineration stared")
    try {

        // User data is now available from the authenticateToken middleware
        const userId = req.user.id;

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
            // const property = await Property.findByIdAndUpdate(
            //     { propertyId },
            //       { $inc: { visted: incrementBy || 1} }, // Increment the 'visted' field
            //       { new: true, runValidators: true } // Return the updated document
            //     );

            const property = await Property.findOneAndUpdate(
                { post_id: propertyId },
                { $inc: { visted: incrementBy || 1 } }, // Increment the 'visted' field
                { new: true, runValidators: true } // Return the updated document
            );
            console.log("property",property)


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