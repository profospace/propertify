
const visitSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemType: {
        type: String,
        enum: ['property', 'project', 'building'],
        required: true
    },
    itemId: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

visitSchema.index({ userId: 1, timestamp: -1 });
const Visit = mongoose.model('Visit', visitSchema);
