const carouselSchema = new mongoose.Schema({
    carouselId: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['property', 'custom', 'banner'],
        default: 'custom'
    },
    autoPlay: {
        type: Boolean,
        default: true
    },
    autoPlayInterval: {
        type: Number,
        default: 3000
    },
    showIndicator: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    items: [{
        imageUrl: String,
        title: String,
        actionUrl: String,
        propertyId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Property' 
        },
        category: String,
        order: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active'
        }
    }]
}, { timestamps: true });

const Carousel = mongoose.model('Carousel', carouselSchema);
