import express from 'express';
import RatingService from '../services/RatingService.js';
import { validateRequest, validateQuery } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route POST /api/v1/ratings/submit
 * @desc Submit a new rating
 * @access Public
 */
router.post(
  '/submit',
  validateRequest('submitRating'),
  asyncHandler(async (req, res) => {
    const { raterId, rateeId, stars, context, contextId, raterInfo } = req.body;

    const rating = await RatingService.submitRating(raterId, rateeId, stars, context, contextId, raterInfo);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: rating,
    });
  })
);

/**
 * @route PUT /api/v1/ratings/:ratingId
 * @desc Edit a rating
 * @access Public
 */
router.put(
  '/:ratingId',
  validateRequest('editRating'),
  asyncHandler(async (req, res) => {
    const { raterId, newStars, reviewText } = req.body;
    const { ratingId } = req.params;

    const rating = await RatingService.editRating(ratingId, raterId, newStars, reviewText);

    res.status(200).json({
      success: true,
      message: 'Rating updated successfully',
      data: rating,
    });
  })
);

/**
 * @route DELETE /api/v1/ratings/:ratingId
 * @desc Delete a rating
 * @access Public
 */
router.delete(
  '/:ratingId',
  asyncHandler(async (req, res) => {
    const { ratingId } = req.params;
    const { raterId } = req.query;

    if (!raterId) {
      return res.status(400).json({ error: 'raterId query parameter is required' });
    }

    const result = await RatingService.deleteRating(ratingId, raterId);

    res.status(200).json({
      success: true,
      message: 'Rating deleted successfully',
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/ratings/user/:userId
 * @desc Get all ratings received by a user
 * @access Public
 */
router.get(
  '/user/:userId',
  validateQuery('pagination'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 10, context } = req.query;

    const result = await RatingService.getRatingsForUser(userId, page, limit, context);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/ratings/given/:userId
 * @desc Get all ratings given by a user
 * @access Public
 */
router.get(
  '/given/:userId',
  validateQuery('pagination'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await RatingService.getRatingsGivenByUser(userId, page, limit);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/ratings/stats/:userId
 * @desc Get rating statistics for a user
 * @access Public
 */
router.get(
  '/stats/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { context } = req.query;

    const stats = await RatingService.getRatingStats(userId, context);

    res.status(200).json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route POST /api/v1/ratings/:ratingId/report
 * @desc Report a rating
 * @access Public
 */
router.post(
  '/:ratingId/report',
  asyncHandler(async (req, res) => {
    const { ratingId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const rating = await RatingService.reportRating(ratingId, reason);

    res.status(200).json({
      success: true,
      message: 'Rating reported successfully',
      data: rating,
    });
  })
);

/**
 * @route GET /api/v1/ratings/seller/:userId
 * @desc Get seller ratings (marketplace context)
 * @access Public
 */
router.get(
  '/seller/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const stats = await RatingService.getSellerRatings(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route GET /api/v1/ratings/service-provider/:userId
 * @desc Get service provider ratings (services context)
 * @access Public
 */
router.get(
  '/service-provider/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const stats = await RatingService.getServiceProviderRatings(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route POST /api/v1/ratings/:ratingId/pin
 * @desc Pin a rating (admin only)
 * @access Admin
 */
router.post(
  '/:ratingId/pin',
  asyncHandler(async (req, res) => {
    const { ratingId } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ error: 'adminId is required' });
    }

    const rating = await RatingService.pinRating(ratingId, adminId);

    res.status(200).json({
      success: true,
      message: 'Rating pinned successfully',
      data: rating,
    });
  })
);

/**
 * @route DELETE /api/v1/ratings/:ratingId/pin
 * @desc Unpin a rating (admin only)
 * @access Admin
 */
router.delete(
  '/:ratingId/pin',
  asyncHandler(async (req, res) => {
    const { ratingId } = req.params;

    const rating = await RatingService.unpinRating(ratingId);

    res.status(200).json({
      success: true,
      message: 'Rating unpinned successfully',
      data: rating,
    });
  })
);

export default router;
