const express = require('express')
const router = express.Router()
const PropertyInteraction = require("../models/PropertyInteraction");
const mixpanel = require('mixpanel');
const { authenticateToken } = require('../middleware/auth');
const mixpanelClient = mixpanel.init('79ff92f256ca2a109638e7812a849f54'); 

// Initialize Mixpanel with your token

// Add authentication middleware for all routes
router.use(authenticateToken);


router.post('/api/interactions', async (req, res) => {
    try {

        // User data is now available from the authenticateToken middleware
        const userId = req.user.id;

        console.log("user id received here "+ userId)

        const {
            propertyId,
            interactionType,
            metadata
        } = req.body;

        const interaction = new PropertyInteraction({
            userId: req.user.id,
            propertyId,
            interactionType,
            metadata: {
                ...metadata,
                timestamp: new Date()
            }
        });

        await interaction.save();


          // Send the interaction data to Mixpanel
          mixpanelClient.track('Property Interaction', {
            distinct_id: req.user.id, // Use the user ID to uniquely identify the user
            property_id: propertyId,
            interaction_type: interactionType,
            metadata: metadata, // Include metadata (e.g., visitDuration, etc.)
            timestamp: new Date().toISOString()
        });

        // Optionally, track additional user properties or interactions in Mixpanel
        // Example: If interactionType is 'VISIT', you can also track page views
        if (interactionType === 'VISIT') {
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
                userPhone: interaction.user.phone,
                metadata: interaction.metadata
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
                    'user.name': 1
                }
            },
            { $sort: { timestamp: -1 } }
        ]);

        res.json({
            success: true,
            data: interactions
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