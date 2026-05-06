import express from 'express';
import TrustScoreService from '../services/TrustScoreService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route POST /api/v1/trust/initialize
 * @desc Initialize trust profile for new user
 * @access Public
 */
router.post(
  '/initialize',
  asyncHandler(async (req, res) => {
    const { userId, userEmail, username } = req.body;

    if (!userId || !userEmail || !username) {
      return res.status(400).json({
        error: 'userId, userEmail, and username are required',
      });
    }

    const trustProfile = await TrustScoreService.initializeTrustProfile(userId, userEmail, username);

    res.status(201).json({
      success: true,
      message: 'Trust profile initialized',
      data: trustProfile,
    });
  })
);

/**
 * @route GET /api/v1/trust/:userId
 * @desc Get trust profile and score for a user
 * @access Public
 */
router.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const trustProfile = await TrustScoreService.getTrustProfile(userId);

    res.status(200).json({
      success: true,
      data: trustProfile,
    });
  })
);

/**
 * @route PUT /api/v1/trust/:userId/recalculate
 * @desc Recalculate trust score for a user
 * @access Admin
 */
router.put(
  '/:userId/recalculate',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const trustProfile = await TrustScoreService.recalculateTrustScore(userId);

    res.status(200).json({
      success: true,
      message: 'Trust score recalculated',
      data: trustProfile,
    });
  })
);

/**
 * @route POST /api/v1/trust/:userId/moderation-penalty
 * @desc Apply moderation penalty to user (admin only)
 * @access Admin
 */
router.post(
  '/:userId/moderation-penalty',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { penaltyPoints, reason } = req.body;

    if (penaltyPoints === undefined || !reason) {
      return res.status(400).json({
        error: 'penaltyPoints and reason are required',
      });
    }

    const trustProfile = await TrustScoreService.applyModerationPenalty(userId, penaltyPoints, reason);

    res.status(200).json({
      success: true,
      message: 'Moderation penalty applied',
      data: trustProfile,
    });
  })
);

/**
 * @route PUT /api/v1/trust/:userId/verification-status
 * @desc Update user verification status (admin only)
 * @access Admin
 */
router.put(
  '/:userId/verification-status',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body;

    if (!status || !['unverified', 'verified', 'premium-verified'].includes(status)) {
      return res.status(400).json({
        error: "status must be 'unverified', 'verified', or 'premium-verified'",
      });
    }

    const trustProfile = await TrustScoreService.updateVerificationStatus(userId, status);

    res.status(200).json({
      success: true,
      message: 'Verification status updated',
      data: trustProfile,
    });
  })
);

/**
 * @route GET /api/v1/trust/top-rated
 * @desc Get top rated users (leaderboard)
 * @access Public
 */
router.get(
  '/leaderboard/top-rated',
  asyncHandler(async (req, res) => {
    const { limit = 10, context } = req.query;

    const topUsers = await TrustScoreService.getTopRatedUsers(parseInt(limit), context);

    res.status(200).json({
      success: true,
      data: topUsers,
    });
  })
);

/**
 * @route GET /api/v1/trust/badge/:badge
 * @desc Get all users with a specific badge
 * @access Public
 */
router.get(
  '/badge/:badge',
  asyncHandler(async (req, res) => {
    const { badge } = req.params;

    const users = await TrustScoreService.getUsersByBadge(badge);

    res.status(200).json({
      success: true,
      data: {
        badge,
        count: users.length,
        users,
      },
    });
  })
);

/**
 * @route GET /api/v1/trust/:userId/history
 * @desc Get trust score history for a user
 * @access Public
 */
router.get(
  '/:userId/history',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const trustProfile = await TrustScoreService.getTrustProfile(userId);

    // Get the last N entries from history
    const history = trustProfile.scoreHistory.slice(-parseInt(limit)).reverse();

    res.status(200).json({
      success: true,
      data: {
        userId,
        currentScore: trustProfile.score,
        currentBadge: trustProfile.badge,
        history,
      },
    });
  })
);

export default router;
