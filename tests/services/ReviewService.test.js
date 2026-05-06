/**
 * Unit tests for ReviewService
 */
import ReviewService from '../../services/ReviewService.js';
import Review from '../../models/Review.js';

// Mock the Review model
jest.mock('../../models/Review.js');

describe('ReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    it('should create a new review successfully', async () => {
      const mockReview = {
        _id: 'review123',
        ratingId: 'rating123',
        raterId: 'user1',
        content: 'Great experience!',
        context: 'marketplace',
        save: jest.fn().mockResolvedValue({
          _id: 'review123',
          ratingId: 'rating123',
          raterId: 'user1',
          content: 'Great experience!',
          context: 'marketplace'
        })
      };

      Review.mockImplementation(() => mockReview);

      const result = await ReviewService.createReview('rating123', 'user1', 'Great experience!', 'marketplace', 'Excellent service', ['helpful', 'professional']);

      expect(result).toBeDefined();
      expect(result.ratingId).toBe('rating123');
      expect(result.raterId).toBe('user1');
      expect(result.content).toBe('Great experience!');
    });

    it('should throw error for invalid content', async () => {
      await expect(
        ReviewService.createReview('rating123', 'user1', 'Too short', 'marketplace')
      ).rejects.toThrow('Content must be at least 10 characters long');
    });

    it('should handle database errors', async () => {
      Review.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      }));

      await expect(
        ReviewService.createReview('rating123', 'user1', 'Great experience!', 'marketplace')
      ).rejects.toThrow('Failed to create review: Database error');
    });
  });

  describe('markHelpful', () => {
    it('should mark review as helpful', async () => {
      const mockReview = {
        _id: 'review123',
        helpfulCount: 5,
        notHelpfulCount: 2,
        save: jest.fn().mockResolvedValue({
          _id: 'review123',
          helpfulCount: 6,
          notHelpfulCount: 2
        })
      };

      Review.findById.mockResolvedValue(mockReview);

      const result = await ReviewService.markHelpful('review123', 'user2');

      expect(result.helpfulCount).toBe(6);
      expect(mockReview.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent review', async () => {
      Review.findById.mockResolvedValue(null);

      await expect(
        ReviewService.markHelpful('nonexistent', 'user2')
      ).rejects.toThrow('Review not found');
    });
  });

  describe('getReviewsByUser', () => {
    it('should get reviews for a user', async () => {
      const mockReviews = [
        { _id: 'review1', rateeId: 'user1', content: 'Great!' },
        { _id: 'review2', rateeId: 'user1', content: 'Excellent!' }
      ];

      Review.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockResolvedValue(mockReviews)
          })
        })
      });

      Review.countDocuments.mockResolvedValue(2);

      const result = await ReviewService.getReviewsByUser('user1', 1, 10);

      expect(result.reviews).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });
});
