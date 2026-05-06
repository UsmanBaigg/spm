import Rating from '../models/Rating.js';
import TrustScoreService from './TrustScoreService.js';

class RatingService {
  /**
   * Submit a new rating
   */
  static async submitRating(raterId, rateeId, stars, context = 'general', contextId = null, raterInfo = {}) {
    try {
      // Check for duplicate rating in same context
      const query = {
        raterId,
        rateeId,
        context,
        status: { $ne: 'deleted' },
      };

      if (contextId) {
        query.contextId = contextId;
      }

      const existingRating = await Rating.findOne(query);

      if (existingRating) {
        throw new Error('Duplicate rating: You have already rated this user in this context');
      }

      // Create new rating
      const newRating = new Rating({
        raterId,
        rateeId,
        stars,
        context,
        contextId,
        raterInfo: {
          username: raterInfo.username || 'Anonymous User',
          profileImage: raterInfo.profileImage || null,
          badge: raterInfo.badge || null,
        },
      });

      const savedRating = await newRating.save();

      // Recalculate trust score for ratee
      await TrustScoreService.recalculateTrustScore(rateeId);

      return savedRating;
    } catch (error) {
      throw new Error(`Failed to submit rating: ${error.message}`);
    }
  }

  /**
   * Edit a rating (within 24 hours)
   */
  static async editRating(ratingId, raterId, newStars, reviewText = null) {
    try {
      const rating = await Rating.findById(ratingId);

      if (!rating) {
        throw new Error('Rating not found');
      }

      if (rating.raterId !== raterId) {
        throw new Error('Unauthorized: You can only edit your own ratings');
      }

      if (!rating.isEditableNow()) {
        throw new Error('Rating can only be edited within 24 hours of creation');
      }

      // Record previous version in edit history
      rating.editHistory.push({
        stars: rating.stars,
        editedAt: new Date(rating.updatedAt),
      });

      // Update rating
      rating.stars = newStars;
      rating.status = 'edited';
      rating.updatedAt = new Date();

      const updatedRating = await rating.save();

      // Recalculate trust score for ratee
      await TrustScoreService.recalculateTrustScore(rating.rateeId);

      return updatedRating;
    } catch (error) {
      throw new Error(`Failed to edit rating: ${error.message}`);
    }
  }

  /**
   * Delete a rating (within 24 hours)
   */
  static async deleteRating(ratingId, raterId) {
    try {
      const rating = await Rating.findById(ratingId);

      if (!rating) {
        throw new Error('Rating not found');
      }

      if (rating.raterId !== raterId) {
        throw new Error('Unauthorized: You can only delete your own ratings');
      }

      if (!rating.isEditableNow()) {
        throw new Error('Rating can only be deleted within 24 hours of creation');
      }

      rating.status = 'deleted';
      await rating.save();

      // Recalculate trust score for ratee
      await TrustScoreService.recalculateTrustScore(rating.rateeId);

      return { success: true, message: 'Rating deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete rating: ${error.message}`);
    }
  }

  /**
   * Get ratings received by a user
   */
  static async getRatingsForUser(userId, page = 1, limit = 10, context = null) {
    try {
      const query = {
        rateeId: userId,
        status: { $ne: 'deleted' },
      };

      if (context) {
        query.context = context;
      }

      const skip = (page - 1) * limit;
      const ratings = await Rating.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Rating.countDocuments(query);

      return {
        ratings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get ratings: ${error.message}`);
    }
  }

  /**
   * Get ratings given by a user
   */
  static async getRatingsGivenByUser(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const ratings = await Rating.find({
        raterId: userId,
        status: { $ne: 'deleted' },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Rating.countDocuments({
        raterId: userId,
        status: { $ne: 'deleted' },
      });

      return {
        ratings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get given ratings: ${error.message}`);
    }
  }

  /**
   * Get rating statistics for a user
   */
  static async getRatingStats(userId, context = null) {
    try {
      const query = {
        rateeId: userId,
        status: { $ne: 'deleted' },
      };

      if (context) {
        query.context = context;
      }

      const ratings = await Rating.find(query);

      if (ratings.length === 0) {
        return {
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          recentRatings: [],
        };
      }

      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalStars = 0;

      ratings.forEach((rating) => {
        distribution[rating.stars] += 1;
        totalStars += rating.stars;
      });

      const averageRating = (totalStars / ratings.length).toFixed(2);

      // Get recent ratings
      const recentRatings = ratings
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      return {
        totalRatings: ratings.length,
        averageRating: parseFloat(averageRating),
        ratingDistribution: distribution,
        recentRatings,
      };
    } catch (error) {
      throw new Error(`Failed to get rating stats: ${error.message}`);
    }
  }

  /**
   * Report a rating
   */
  static async reportRating(ratingId, reason) {
    try {
      const rating = await Rating.findById(ratingId);

      if (!rating) {
        throw new Error('Rating not found');
      }

      rating.reportCount += 1;

      // Flag if multiple reports
      if (rating.reportCount >= 3) {
        rating.status = 'flagged';
      }

      await rating.save();

      return rating;
    } catch (error) {
      throw new Error(`Failed to report rating: ${error.message}`);
    }
  }

  /**
   * Get seller ratings (marketplace context)
   */
  static async getSellerRatings(userId) {
    try {
      return this.getRatingStats(userId, 'marketplace');
    } catch (error) {
      throw new Error(`Failed to get seller ratings: ${error.message}`);
    }
  }

  /**
   * Get service provider ratings (services context)
   */
  static async getServiceProviderRatings(userId) {
    try {
      return this.getRatingStats(userId, 'services');
    } catch (error) {
      throw new Error(`Failed to get service provider ratings: ${error.message}`);
    }
  }

  /**
   * Pin a rating (admin only)
   */
  static async pinRating(ratingId, adminId) {
    try {
      const rating = await Rating.findByIdAndUpdate(ratingId, { isPinned: true }, { new: true });

      if (!rating) {
        throw new Error('Rating not found');
      }

      return rating;
    } catch (error) {
      throw new Error(`Failed to pin rating: ${error.message}`);
    }
  }

  /**
   * Unpin a rating (admin only)
   */
  static async unpinRating(ratingId) {
    try {
      const rating = await Rating.findByIdAndUpdate(ratingId, { isPinned: false }, { new: true });

      if (!rating) {
        throw new Error('Rating not found');
      }

      return rating;
    } catch (error) {
      throw new Error(`Failed to unpin rating: ${error.message}`);
    }
  }
}

export default RatingService;
