import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    ratingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rating',
      required: true,
      unique: true,
    },
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
    title: {
      type: String,
      default: null,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 500,
    },
    context: {
      type: String,
      enum: ['marketplace', 'services', 'general'],
      default: 'general',
    },
    tags: [
      {
        type: String,
        enum: ['helpful', 'reliable', 'friendly', 'professional', 'poor-quality', 'unresponsive', 'dishonest'],
      },
    ],
    reportCount: {
      type: Number,
      default: 0,
    },
    flagReasons: [
      {
        reason: {
          type: String,
          enum: ['spam', 'offensive', 'fake', 'harassment', 'inappropriate'],
        },
        count: Number,
        flaggedAt: Date,
      },
    ],
    status: {
      type: String,
      enum: ['published', 'edited', 'flagged', 'removed', 'admin-removed'],
      default: 'published',
    },
    adminNotes: {
      type: String,
      default: null,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    notHelpfulCount: {
      type: Number,
      default: 0,
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
        content: String,
        editedAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
reviewSchema.index({ rateeId: 1, createdAt: -1 });
reviewSchema.index({ raterId: 1, createdAt: -1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ ratingId: 1 });

// Virtual for helpfulness percentage
reviewSchema.virtual('helpfulnessPercentage').get(function () {
  const total = this.helpfulCount + this.notHelpfulCount;
  if (total === 0) return 0;
  return Math.round((this.helpfulCount / total) * 100);
});

export default mongoose.model('Review', reviewSchema);
