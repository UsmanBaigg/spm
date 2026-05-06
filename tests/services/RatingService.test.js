import { jest } from '@jest/globals';
/**
 * Unit tests for RatingService
 */
import RatingService from '../../services/RatingService.js';
import Rating from '../../models/Rating.js';

// Mock the Rating model
jest.mock('../../models/Rating.js');

describe('RatingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitRating', () => {
    it('should submit a new rating successfully', async () => {
      const mockRating = {
        _id: 'rating123',
        raterId: 'user1',
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace',
        save: jest.fn().mockResolvedValue({
          _id: 'rating123',
          raterId: 'user1',
          rateeId: 'user2',
          stars: 5,
          context: 'marketplace'
        })
      };

      Rating.findOne.mockResolvedValue(null);
      Rating.mockImplementation(() => mockRating);

      const TrustScoreService = require('../../services/TrustScoreService.js');
      TrustScoreService.recalculateTrustScore = jest.fn().mockResolvedValue({});

      const result = await RatingService.submitRating('user1', 'user2', 5, 'marketplace', 'tx123', {
        username: 'testuser',
        profileImage: 'http://example.com/image.jpg',
        badge: 'verified'
      });

      expect(result).toBeDefined();
      expect(result.raterId).toBe('user1');
      expect(result.rateeId).toBe('user2');
      expect(result.stars).toBe(5);
      expect(TrustScoreService.recalculateTrustScore).toHaveBeenCalledWith('user2');
    });

    it('should throw error for duplicate rating', async () => {
      const existingRating = {
        raterId: 'user1',
        rateeId: 'user2',
        context: 'marketplace'
      };

      Rating.findOne.mockResolvedValue(existingRating);

      await expect(
        RatingService.submitRating('user1', 'user2', 5, 'marketplace')
      ).rejects.toThrow('Duplicate rating');
    });

    it('should handle database errors', async () => {
      Rating.findOne.mockRejectedValue(new Error('Database error'));

      await expect(
        RatingService.submitRating('user1', 'user2', 5, 'marketplace')
      ).rejects.toThrow('Failed to submit rating: Database error');
    });
  });

  describe('getRatingStats', () => {
    it('should calculate rating statistics correctly', async () => {
      const mockRatings = [
        { stars: 5 },
        { stars: 4 },
        { stars: 5 },
        { stars: 3 },
        { stars: 5 }
      ];

      Rating.aggregate.mockResolvedValue(mockRatings);

      const result = await RatingService.getRatingStats('user2');

      expect(result.totalRatings).toBe(5);
      expect(result.averageRating).toBe(4.4);
      expect(result.distribution).toEqual({
        5: 3,
        4: 1,
        3: 1,
        2: 0,
        1: 0
      });
    });

    it('should return zero stats for user with no ratings', async () => {
      Rating.aggregate.mockResolvedValue([]);

      const result = await RatingService.getRatingStats('user2');

      expect(result.totalRatings).toBe(0);
      expect(result.averageRating).toBe(0);
      expect(result.distribution).toEqual({
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0
      });
    });
  });
});

