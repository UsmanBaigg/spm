import mongoose from 'mongoose';

const trustScoreSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
      max: 100,
    },
    badge: {
      type: String,
      enum: ['new-neighbor', 'community-member', 'trusted-neighbor', 'verified-contributor', 'community-star', 'verified-seller', 'trusted-service-provider'],
      default: 'new-neighbor',
    },
    metrics: {
      totalRatingsReceived: {
        type: Number,
        default: 0,
      },
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      marketplaceRatings: {
        count: { type: Number, default: 0 },
        average: { type: Number, default: 0 },
      },
      serviceRatings: {
        count: { type: Number, default: 0 },
        average: { type: Number, default: 0 },
      },
      accountAgeDays: {
        type: Number,
        default: 0,
      },
      verificationStatus: {
        type: String,
        enum: ['unverified', 'verified', 'premium-verified'],
        default: 'unverified',
      },
      moderationIncidents: {
        type: Number,
        default: 0,
      },
    },
    weightedFactors: {
      ratingWeight: {
        type: Number,
        default: 0.4, // 40%
      },
      volumeWeight: {
        type: Number,
        default: 0.2, // 20%
      },
      accountAgeWeight: {
        type: Number,
        default: 0.1, // 10%
      },
      verificationBonus: {
        type: Number,
        default: 0.15, // 15%
      },
      moderationPenalty: {
        type: Number,
        default: 0, // up to -25%
      },
    },
    badges: {
      verifiedSeller: {
        earned: { type: Boolean, default: false },
        earnedDate: Date,
      },
      trustedServiceProvider: {
        earned: { type: Boolean, default: false },
        earnedDate: Date,
      },
    },
    scoreHistory: [
      {
        score: Number,
        badge: String,
        reason: String, // 'new-rating', 'moderation', 'account-age', etc.
        changedAt: Date,
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
    nextRecalculationDate: {
      type: Date,
      default: Date.now,
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
  },
  {
    timestamps: true,
  }
);

// Indexes
trustScoreSchema.index({ score: -1 });
trustScoreSchema.index({ badge: 1 });
trustScoreSchema.index({ lastUpdated: -1 });

// Method to determine badge based on score
trustScoreSchema.statics.determineBadge = function (score) {
  if (score >= 95) return 'community-star';
  if (score >= 80) return 'verified-contributor';
  if (score >= 60) return 'trusted-neighbor';
  if (score >= 31) return 'community-member';
  return 'new-neighbor';
};

// Method to check if user qualifies for seller badge
trustScoreSchema.methods.qualifiesForSellerBadge = function () {
  const { marketplaceRatings } = this.metrics;
  return marketplaceRatings.count >= 10 && marketplaceRatings.average >= 4.0;
};

// Method to check if user qualifies for service provider badge
trustScoreSchema.methods.qualifiesForServiceProviderBadge = function () {
  const { serviceRatings } = this.metrics;
  return serviceRatings.count >= 5 && serviceRatings.average >= 4.2;
};

// Method to get score breakdown
trustScoreSchema.methods.getScoreBreakdown = function () {
  return {
    score: this.score,
    badge: this.badge,
    metrics: this.metrics,
    weightedFactors: this.weightedFactors,
    qualifications: {
      isSellerVerified: this.badges.verifiedSeller.earned,
      isServiceProviderVerified: this.badges.trustedServiceProvider.earned,
    },
  };
};

export default mongoose.model('TrustScore', trustScoreSchema);
