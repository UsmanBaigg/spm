import TrustScore from '../models/TrustScore.js';
import Rating from '../models/Rating.js';

class TrustScoreService {
  /**
   * Initialize trust profile for new user
   */
  static async initializeTrustProfile(userId, userEmail, username) {
    try {
      const existingProfile = await TrustScore.findOne({ userId });
      
      if (existingProfile) {
        return existingProfile;
      }

      const initialScore = 50; // Default score
      const trustProfile = new TrustScore({
        userId,
        score: initialScore,
        badge: TrustScore.determineBadge(initialScore),
        metrics: {
          totalRatingsReceived: 0,
          averageRating: 0,
          accountAgeDays: 0,
          verificationStatus: 'unverified',
          moderationIncidents: 0,
        },
        scoreHistory: [
          {
            score: initialScore,
            badge: TrustScore.determineBadge(initialScore),
            reason: 'user-registration',
            changedAt: new Date(),
          },
        ],
      });

      await trustProfile.save();
      return trustProfile;
    } catch (error) {
      throw new Error(`Failed to initialize trust profile: ${error.message}`);
    }
  }

  /**
   * Calculate weighted trust score
   * Formula: (rating% * 0.4) + (volume% * 0.2) + (age% * 0.1) + (verification* * 0.15) + moderationPenalty
   */
  static async recalculateTrustScore(userId) {
    try {
      const trustProfile = await TrustScore.findOne({ userId });
      
      if (!trustProfile) {
        throw new Error('Trust profile not found');
      }

      // Get all active ratings for the user
      const ratings = await Rating.find({
        rateeId: userId,
        status: { $ne: 'deleted' },
      });

      // Separate ratings by context
      const marketplaceRatings = ratings.filter((r) => r.context === 'marketplace');
      const serviceRatings = ratings.filter((r) => r.context === 'services');

      // Calculate averages
      const totalRatings = ratings.length;
      const averageRating = totalRatings > 0
        ? ratings.reduce((sum, r) => sum + r.stars, 0) / totalRatings
        : 0;

      const marketplaceAvg = marketplaceRatings.length > 0
        ? marketplaceRatings.reduce((sum, r) => sum + r.stars, 0) / marketplaceRatings.length
        : 0;

      const serviceAvg = serviceRatings.length > 0
        ? serviceRatings.reduce((sum, r) => sum + r.stars, 0) / serviceRatings.length
        : 0;

      // Update metrics
      trustProfile.metrics.totalRatingsReceived = totalRatings;
      trustProfile.metrics.averageRating = averageRating;
      trustProfile.metrics.marketplaceRatings = {
        count: marketplaceRatings.length,
        average: marketplaceAvg,
      };
      trustProfile.metrics.serviceRatings = {
        count: serviceRatings.length,
        average: serviceAvg,
      };

      // Calculate account age (in days)
      const now = new Date();
      const createdAt = trustProfile.createdAt;
      const accountAgeDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      trustProfile.metrics.accountAgeDays = accountAgeDays;

      // Calculate score components
      const ratingComponent = (averageRating / 5) * 40;
      const volumeComponent = Math.min(totalRatings / 50, 1) * 20;
      const ageComponent = Math.min(accountAgeDays / 365, 1) * 10;
      const verificationBonus = trustProfile.metrics.verificationStatus === 'verified' ? 15 : 0;
      const moderationPenalty = Math.max(trustProfile.metrics.moderationIncidents * -5, -25);

      // Calculate final score
      let newScore = ratingComponent + volumeComponent + ageComponent + verificationBonus + moderationPenalty;
      newScore = Math.max(0, Math.min(100, Math.round(newScore * 10) / 10)); // Clamp to 0-100

      // Update weighted factors
      trustProfile.weightedFactors = {
        ratingWeight: ratingComponent,
        volumeWeight: volumeComponent,
        accountAgeWeight: ageComponent,
        verificationBonus,
        moderationPenalty,
      };

      // Determine badge
      const newBadge = TrustScore.determineBadge(newScore);
      const badgeChanged = trustProfile.badge !== newBadge;

      // Check seller badge eligibility
      const qualifiesForSeller = trustProfile.qualifiesForSellerBadge();
      const qualifiesForServiceProvider = trustProfile.qualifiesForServiceProviderBadge();

      // Update badges
      if (qualifiesForSeller && !trustProfile.badges.verifiedSeller.earned) {
        trustProfile.badges.verifiedSeller = {
          earned: true,
          earnedDate: new Date(),
        };
      } else if (!qualifiesForSeller && trustProfile.badges.verifiedSeller.earned) {
        trustProfile.badges.verifiedSeller = {
          earned: false,
          earnedDate: null,
        };
      }

      if (qualifiesForServiceProvider && !trustProfile.badges.trustedServiceProvider.earned) {
        trustProfile.badges.trustedServiceProvider = {
          earned: true,
          earnedDate: new Date(),
        };
      } else if (!qualifiesForServiceProvider && trustProfile.badges.trustedServiceProvider.earned) {
        trustProfile.badges.trustedServiceProvider = {
          earned: false,
          earnedDate: null,
        };
      }

      // Update score and badge
      if (newScore !== trustProfile.score || badgeChanged) {
        trustProfile.score = newScore;
        trustProfile.badge = newBadge;

        // Record score change in history
        trustProfile.scoreHistory.push({
          score: newScore,
          badge: newBadge,
          reason: 'rating-update',
          changedAt: new Date(),
        });

        // Keep only last 100 history entries
        if (trustProfile.scoreHistory.length > 100) {
          trustProfile.scoreHistory = trustProfile.scoreHistory.slice(-100);
        }
      }

      trustProfile.lastUpdated = new Date();
      await trustProfile.save();

      return trustProfile;
    } catch (error) {
      throw new Error(`Failed to recalculate trust score: ${error.message}`);
    }
  }

  /**
   * Get trust profile for user
   */
  static async getTrustProfile(userId) {
    try {
      const trustProfile = await TrustScore.findOne({ userId });
      
      if (!trustProfile) {
        throw new Error('Trust profile not found');
      }

      return trustProfile.getScoreBreakdown();
    } catch (error) {
      throw new Error(`Failed to get trust profile: ${error.message}`);
    }
  }

  /**
   * Apply moderation penalty
   */
  static async applyModerationPenalty(userId, penaltyPoints, reason) {
    try {
      const trustProfile = await TrustScore.findOne({ userId });
      
      if (!trustProfile) {
        throw new Error('Trust profile not found');
      }

      trustProfile.metrics.moderationIncidents += 1;
      
      // Record in history
      trustProfile.scoreHistory.push({
        score: trustProfile.score,
        badge: trustProfile.badge,
        reason: `moderation-penalty: ${reason}`,
        changedAt: new Date(),
      });

      // Recalculate score with penalty
      await this.recalculateTrustScore(userId);

      return trustProfile;
    } catch (error) {
      throw new Error(`Failed to apply moderation penalty: ${error.message}`);
    }
  }

  /**
   * Get top rated users (for leaderboard)
   */
  static async getTopRatedUsers(limit = 10, context = null) {
    try {
      let query = {};
      if (context) {
        query = context === 'marketplace'
          ? { 'metrics.marketplaceRatings.average': { $gte: 4.0 } }
          : { 'metrics.serviceRatings.average': { $gte: 4.0 } };
      }

      const topUsers = await TrustScore.find(query)
        .sort({ score: -1 })
        .limit(limit);

      return topUsers;
    } catch (error) {
      throw new Error(`Failed to get top rated users: ${error.message}`);
    }
  }

  /**
   * Get users with specific badge
   */
  static async getUsersByBadge(badge) {
    try {
      const users = await TrustScore.find({ badge }).sort({ score: -1 });
      return users;
    } catch (error) {
      throw new Error(`Failed to get users by badge: ${error.message}`);
    }
  }

  /**
   * Update verification status
   */
  static async updateVerificationStatus(userId, status) {
    try {
      const trustProfile = await TrustScore.findOne({ userId });
      
      if (!trustProfile) {
        throw new Error('Trust profile not found');
      }

      trustProfile.metrics.verificationStatus = status;
      await this.recalculateTrustScore(userId);

      return trustProfile;
    } catch (error) {
      throw new Error(`Failed to update verification status: ${error.message}`);
    }
  }
}

export default TrustScoreService;
