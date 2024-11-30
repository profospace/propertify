const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  post_id: String,
  type_id: String,
  user_id: String,
  building_id: String,
  type_name: String,
  user_name: String,
  user_image: String,
  post_title: String,
  post_description: String,
  phone: String,
  address: String,
  floor: String,
  agreement: String,
  priceUnit: String,
  areaUnit: String,
  usp: [String],
  ownerName: String,
  contactList: [Number],
  latitude: Number,
  longitude: Number,
  purpose: String,
  bedrooms: Number,
  bathrooms: Number,
  
  // Enhanced relationship fields
  builder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Builder'
  },
  building: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  
  // Project-specific fields
  projectPhase: {
    type: String,
    default: null
  },
  floorPlanId: {
    type: String,
    default: null
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: false
    },
    coordinates: {
      type: [Number],
      required: false
    }
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
  galleryList: [String],
  relatedProperty: [String],
  furnishStatus: String,
  carpetArea: Number,
  superBuiltupArea: Number,
  available: Boolean,
  category: Number,
  tags: [String],
  region: String,
  construction_status: String,
  possession: String,
  broker_status: String,
  facilities: [String],
  location_advantage: [String],
  project_details: String,
  official_brochure: String,
  
  // Property specific fields
  pricePerSqFt: Number,
  estimatedEMI: Number,
  reraStatus: String,
  reraRegistrationNumber: String,
  reraWebsite: String,
  configuration: String,
  facing: String,
  floorNumber: Number,
  totalFloors: Number,
  overlookingAmenities: [String],
  possessionDate: Date,
  transactionType: String,
  propertyOwnership: String,
  flooring: String,
  parking: String,
  propertyCode: String,
  widthOfFacingRoad: Number,
  gatedCommunity: Boolean,
  waterSource: [String],
  powerBackup: String,
  petFriendly: Boolean,
  
  propertyTypes: [String],
  propertyFeatures: [String],
  viewTypes: [String],
  propertyConditions: [String],
  legalStatuses: [String],
  constructionStatuses: [String],
  ownershipTypes: [String],
  financingOptions: [String],
  propertyTaxClasses: [String],
  environmentalCertifications: [String],
  propertyManagementServices: [String],
  investmentStrategies: [String]
}, { timestamps: true });

// Indexes
propertySchema.index({ location: '2dsphere' });




module.exports = mongoose.model('Property', propertySchema);