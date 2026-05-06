import express from 'express';
import ReviewService from '../services/ReviewService.js';
import { validateRequest, validateQuery } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route POST /api/v1/reviews
 * @desc Create a new review for a rating
 * @access Public
 */
router.post(
  '/',
  validateRequest('createReview'),
  asyncHandler(async (req, res) => {
    const { ratingId, raterId, content, context, title, tags } = req.body;

    const review = await ReviewService.createReview(ratingId, raterId, content, context, title, tags);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review,
    });
  })
);

/**
 * @route PUT /api/v1/reviews/:reviewId
 * @desc Edit a review
 * @access Public
 */
router.put(
  '/:reviewId',
  validateRequest('editReview'),
  asyncHandler(async (req, res) => {
    const { raterId, content, tags } = req.body;
    const { reviewId } = req.params;

    const review = await ReviewService.editReview(reviewId, raterId, content, tags);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: review,
    });
  })
);

/**
 * @route DELETE /api/v1/reviews/:reviewId
 * @desc Delete a review
 * @access Public
 */
router.delete(
  '/:reviewId',
  asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { raterId } = req.query;

    if (!raterId) {
      return res.status(400).json({ error: 'raterId query parameter is required' });
    }

    const result = await ReviewService.deleteReview(reviewId, raterId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/reviews/user/:userId
 * @desc Get all reviews received by a user
 * @access Public
 */
router.get(
  '/user/:userId',
  validateQuery('pagination'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 10, context } = req.query;

    const result = await ReviewService.getReviewsForUser(userId, page, limit, context);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/reviews/written/:userId
 * @desc Get all reviews written by a user
 * @access Public
 */
router.get(
  '/written/:userId',
  validateQuery('pagination'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await ReviewService.getReviewsWrittenByUser(userId, page, limit);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route POST /api/v1/reviews/:reviewId/helpful
 * @desc Mark a review as helpful
 * @access Public
 */
router.post(
  '/:reviewId/helpful',
  asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await ReviewService.markHelpful(reviewId);

    res.status(200).json({
      success: true,
      message: 'Review marked as helpful',
      data: review,
    });
  })
);

/**
 * @route POST /api/v1/reviews/:reviewId/not-helpful
 * @desc Mark a review as not helpful
 * @access Public
 */
router.post(
  '/:reviewId/not-helpful',
  asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await ReviewService.markNotHelpful(reviewId);

    res.status(200).json({
      success: true,
      message: 'Review marked as not helpful',
      data: review,
    });
  })
);

/**
 * @route POST /api/v1/reviews/:reviewId/report
 * @desc Report a review
 * @access Public
 */
router.post(
  '/:reviewId/report',
  validateRequest('reportReview'),
  asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { reason } = req.body;

    const review = await ReviewService.reportReview(reviewId, reason);

    res.status(200).json({
      success: true,
      message: 'Review reported successfully',
      data: review,
    });
  })
);

/**
 * @route GET /api/v1/reviews/helpful/:userId
 * @desc Get most helpful reviews for a user
 * @access Public
 */
router.get(
  '/helpful/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { limit = 5 } = req.query;

    const reviews = await ReviewService.getMostHelpfulReviews(userId, limit);

    res.status(200).json({
      success: true,
      data: reviews,
    });
  })
);

/**
 * @route GET /api/v1/reviews/admin/flagged
 * @desc Get flagged reviews (admin only)
 * @access Admin
 */
router.get(
  '/admin/flagged',
  validateQuery('pagination'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const result = await ReviewService.getFlaggedReviews(page, limit);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route POST /api/v1/reviews/:reviewId/admin/approve
 * @desc Approve flagged review (admin only)
 * @access Admin
 */
router.post(
  '/:reviewId/admin/approve',
  asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await ReviewService.approveFlaggedReview(reviewId);

    res.status(200).json({
      success: true,
      message: 'Review approved successfully',
      data: review,
    });
  })
);

/**
 * @route DELETE /api/v1/reviews/:reviewId/admin/remove
 * @desc Remove review (admin only)
 * @access Admin
 */
router.delete(
  '/:reviewId/admin/remove',
  asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { adminNotes } = req.body;

    const review = await ReviewService.removeReviewAsAdmin(reviewId, adminNotes);

    res.status(200).json({
      success: true,
      message: 'Review removed successfully',
      data: review,
    });
  })
);

export default router;
