import Review from '../models/Review.js';
import Rating from '../models/Rating.js';

class ReviewService {
  /**
   * Create a review for a rating
   */
  static async createReview(ratingId, raterId, content, context = 'general', title = null, tags = []) {
    try {
      // Check if rating exists and belongs to rater
      const rating = await Rating.findById(ratingId);

      if (!rating) {
        throw new Error('Rating not found');
      }

      if (rating.raterId !== raterId) {
        throw new Error('Unauthorized: You can only review your own ratings');
      }

      // Check if review already exists for this rating
      const existingReview = await Review.findOne({ ratingId });

      if (existingReview) {
        throw new Error('Review already exists for this rating');
      }

      // Create new review
      const newReview = new Review({
        ratingId,
        raterId,
        rateeId: rating.rateeId,
        title,
        content,
        context,
        tags,
      });

      const savedReview = await newReview.save();

      // Link review to rating
      rating.reviewId = savedReview._id;
      await rating.save();

      return savedReview;
    } catch (error) {
      throw new Error(`Failed to create review: ${error.message}`);
    }
  }

  /**
   * Edit a review (within 24 hours)
   */
  static async editReview(reviewId, raterId, content, tags = []) {
    try {
      const review = await Review.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      if (review.raterId !== raterId) {
        throw new Error('Unauthorized: You can only edit your own reviews');
      }

      // Check if within edit window
      const now = new Date();
      const created = new Date(review.createdAt);
      const hoursDiff = (now - created) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        throw new Error('Review can only be edited within 24 hours of creation');
      }

      // Record edit history
      review.editHistory.push({
        content: review.content,
        editedAt: new Date(review.updatedAt),
      });

      // Update review
      review.content = content;
      review.tags = tags;
      review.status = 'edited';
      review.updatedAt = new Date();

      const updatedReview = await review.save();

      return updatedReview;
    } catch (error) {
      throw new Error(`Failed to edit review: ${error.message}`);
    }
  }

  /**
   * Delete a review (within 24 hours)
   */
  static async deleteReview(reviewId, raterId) {
    try {
      const review = await Review.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      if (review.raterId !== raterId) {
        throw new Error('Unauthorized: You can only delete your own reviews');
      }

      // Check if within delete window
      const now = new Date();
      const created = new Date(review.createdAt);
      const hoursDiff = (now - created) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        throw new Error('Review can only be deleted within 24 hours of creation');
      }

      review.status = 'removed';
      await review.save();

      // Remove review reference from rating
      const rating = await Rating.findById(review.ratingId);
      if (rating) {
        rating.reviewId = null;
        await rating.save();
      }

      return { success: true, message: 'Review deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete review: ${error.message}`);
    }
  }

  /**
   * Get reviews for a user
   */
  static async getReviewsForUser(userId, page = 1, limit = 10, context = null) {
    try {
      const query = {
        rateeId: userId,
        status: { $ne: 'removed' },
      };

      if (context) {
        query.context = context;
      }

      const skip = (page - 1) * limit;
      const reviews = await Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ratingId', 'stars')
        .lean();

      const total = await Review.countDocuments(query);

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get reviews: ${error.message}`);
    }
  }

  /**
   * Get reviews written by a user
   */
  static async getReviewsWrittenByUser(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const reviews = await Review.find({
        raterId: userId,
        status: { $ne: 'removed' },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Review.countDocuments({
        raterId: userId,
        status: { $ne: 'removed' },
      });

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get written reviews: ${error.message}`);
    }
  }

  /**
   * Mark review as helpful
   */
  static async markHelpful(reviewId) {
    try {
      const review = await Review.findByIdAndUpdate(
        reviewId,
        { $inc: { helpfulCount: 1 } },
        { new: true }
      );

      if (!review) {
        throw new Error('Review not found');
      }

      return review;
    } catch (error) {
      throw new Error(`Failed to mark review as helpful: ${error.message}`);
    }
  }

  /**
   * Mark review as not helpful
   */
  static async markNotHelpful(reviewId) {
    try {
      const review = await Review.findByIdAndUpdate(
        reviewId,
        { $inc: { notHelpfulCount: 1 } },
        { new: true }
      );

      if (!review) {
        throw new Error('Review not found');
      }

      return review;
    } catch (error) {
      throw new Error(`Failed to mark review as not helpful: ${error.message}`);
    }
  }

  /**
   * Report a review
   */
  static async reportReview(reviewId, reason) {
    try {
      const review = await Review.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      // Add flag reason
      const existingFlag = review.flagReasons.find((f) => f.reason === reason);

      if (existingFlag) {
        existingFlag.count += 1;
        existingFlag.flaggedAt = new Date();
      } else {
        review.flagReasons.push({
          reason,
          count: 1,
          flaggedAt: new Date(),
        });
      }

      review.reportCount += 1;

      // Flag if multiple reports
      if (review.reportCount >= 3) {
        review.status = 'flagged';
      }

      await review.save();

      return review;
    } catch (error) {
      throw new Error(`Failed to report review: ${error.message}`);
    }
  }

  /**
   * Get most helpful reviews
   */
  static async getMostHelpfulReviews(userId, limit = 5) {
    try {
      const reviews = await Review.find({
        rateeId: userId,
        status: { $ne: 'removed' },
      })
        .sort({ helpfulCount: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      return reviews;
    } catch (error) {
      throw new Error(`Failed to get most helpful reviews: ${error.message}`);
    }
  }

  /**
   * Get flagged reviews (admin only)
   */
  static async getFlaggedReviews(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const reviews = await Review.find({ status: 'flagged' })
        .sort({ reportCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Review.countDocuments({ status: 'flagged' });

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get flagged reviews: ${error.message}`);
    }
  }

  /**
   * Admin action: Approve flagged review
   */
  static async approveFlaggedReview(reviewId) {
    try {
      const review = await Review.findByIdAndUpdate(
        reviewId,
        { status: 'published', reportCount: 0, flagReasons: [] },
        { new: true }
      );

      if (!review) {
        throw new Error('Review not found');
      }

      return review;
    } catch (error) {
      throw new Error(`Failed to approve review: ${error.message}`);
    }
  }

  /**
   * Admin action: Remove review
   */
  static async removeReviewAsAdmin(reviewId, adminNotes) {
    try {
      const review = await Review.findByIdAndUpdate(
        reviewId,
        { status: 'admin-removed', adminNotes },
        { new: true }
      );

      if (!review) {
        throw new Error('Review not found');
      }

      // Update rating to remove review reference
      await Rating.findByIdAndUpdate(review.ratingId, { reviewId: null });

      return review;
    } catch (error) {
      throw new Error(`Failed to remove review: ${error.message}`);
    }
  }
}

export default ReviewService;
