import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    raterId: {
      type: String,
      required: true,
      index: true,
    },
    rateeId: {
      type: String,
      required: true,
      index: true,
    },
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Stars must be an integer',
      },
    },
    context: {
      type: String,
      enum: ['marketplace', 'services', 'general'],
      default: 'general',
      index: true,
    },
    contextId: {
      type: String,
      default: null, // e.g., transaction ID from marketplace
    },
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      default: null,
    },
    raterInfo: {
      username: String,
      profileImage: String,
      badge: String,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'edited', 'flagged', 'deleted'],
      default: 'active',
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    editHistory: [
      {
        stars: Number,
        editedAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for duplicate prevention
ratingSchema.index({ raterId: 1, rateeId: 1, context: 1, contextId: 1 }, { unique: true, sparse: true });
ratingSchema.index({ rateeId: 1, createdAt: -1 });
ratingSchema.index({ raterId: 1, createdAt: -1 });
ratingSchema.index({ status: 1 });

// Virtual for time since creation
ratingSchema.virtual('daysOld').get(function () {
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Check if rating is within edit window (24 hours)
ratingSchema.methods.isEditableNow = function () {
  const now = new Date();
  const created = new Date(this.createdAt);
  const hoursDiff = (now - created) / (1000 * 60 * 60);
  return hoursDiff < 24;
};

export default mongoose.model('Rating', ratingSchema);
