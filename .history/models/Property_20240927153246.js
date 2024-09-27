const mongoose = require('mongoose');

// EntityType Enum
const EntityType = {
    FLAT: 1,
    SHOP: 2,
    COMMERCIAL_HALL: 3,
    BANQUET: 4,
    ROOM: 5,
    OFFICE: 6,
    WAREHOUSE: 7,
    UNDERGROUND: 8
};

// Function to get entity name from EntityType
const getEntityName = (entityType) => {
    return Object.keys(EntityType).find(key => EntityType[key] === entityType);
};

// Updated Flat (now Entity) Schema
const entitySchema = new mongoose.Schema({
    floorNumber: Number,
    entityNumber: String,
    price: Number,
    entityType: {
        type: Number,
        enum: Object.values(EntityType),
        required: true
    },
    area: Number,
    balconyArea: Number,
    benefits: [String],
    photos: [String],
    furnishStatus: String,
    carpetArea: Number,
    superBuiltupArea: Number,
    available: Boolean,
    category: Number
});

// Updated Property Schema
const propertySchema = new mongoose.Schema({
    post_id: String,
    type_id: String,
    user_id: String,
    building_id: String,
    entity_type: {
        type: Number,
        enum: Object.values(EntityType),
        required: true
    },
    max_floor: String,
    user_name: String,
    post_title: String,
    post_description: String,
    phone: String,
    address: String,
    location: {
        type: { type: String, enum: ['Point'], required: false },
        coordinates: { type: [Number], required: false }
    },
    area: String,
    anyConstraint: [Number],
    furnishing: String,
    amenities: [String],
    price: Number,
    verified: Boolean,
    post_image: String,
    floor_plan_image: String,
    total_views: Number,
    favourite: Boolean,
    gallery_list: [{
        gallery_id: String,
        gallery_image: String
    }],
    relatedProperty: [String],
    tags: [String],
    region: String,
    construction_status: String,
    possession: String,
    broker_status: String,
    facilities: [String],
    location_advantage: [String],
    project_details: String,
    official_brochure: String,
    builder_name: String,
    builder_group: String,
    entities_available: String,
    entity_details: [entitySchema],
    bedrooms: Number,
    bathrooms: Number,
    purpose: String
}, { timestamps: true });

// Virtual for type_name
propertySchema.virtual('type_name').get(function() {
    return getEntityName(this.entity_type);
});

propertySchema.set('toJSON', { virtuals: true });
propertySchema.set('toObject', { virtuals: true });

propertySchema.index({ location: '2dsphere' });

module.exports = {
    Property: mongoose.model('Property', propertySchema),
    EntityType: EntityType
};