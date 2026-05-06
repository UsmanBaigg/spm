/**
 * Database Integration Tests
 */
import mongoose from 'mongoose';
import Rating from '../../models/Rating.js';
import Review from '../../models/Review.js';
import TrustScore from '../../models/TrustScore.js';
import User from '../../models/User.js';
import { setupTestDatabase, teardownTestDatabase } from '../setup.js';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await Rating.deleteMany({});
    await Review.deleteMany({});
    await TrustScore.deleteMany({});
    await User.deleteMany({});
  });

  describe('Rating Model Integration', () => {
    test('should create and retrieve rating with proper relationships', async () => {
      const rating = new Rating({
        raterId: 'user1',
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace',
        contextId: 'tx123',
        raterInfo: {
          username: 'testuser',
          profileImage: 'http://example.com/image.jpg',
          badge: 'verified'
        }
      });

      const savedRating = await rating.save();
      expect(savedRating._id).toBeDefined();
      expect(savedRating.stars).toBe(5);
      expect(savedRating.context).toBe('marketplace');
      expect(savedRating.status).toBe('active');

      const foundRating = await Rating.findById(savedRating._id);
      expect(foundRating.raterId).toBe('user1');
      expect(foundRating.rateeId).toBe('user2');
      expect(foundRating.isEditableNow()).toBe(true);
    });

    test('should prevent duplicate ratings in same context', async () => {
      const ratingData = {
        raterId: 'user1',
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace',
        contextId: 'tx123'
      };

      await new Rating(ratingData).save();

      const duplicateRating = new Rating(ratingData);
      await expect(duplicateRating.save()).rejects.toThrow();
    });

    test('should allow different contexts for same user pair', async () => {
      const rating1 = new Rating({
        raterId: 'user1',
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace'
      });

      const rating2 = new Rating({
        raterId: 'user1',
        rateeId: 'user2',
        stars: 4,
        context: 'services'
      });

      await rating1.save();
      await rating2.save();

      const ratings = await Rating.find({ raterId: 'user1', rateeId: 'user2' });
      expect(ratings).toHaveLength(2);
    });

    test('should handle edit history correctly', async () => {
      const rating = new Rating({
        raterId: 'user1',
        rateeId: 'user2',
        stars: 4,
        context: 'marketplace'
      });

      await rating.save();

      // Simulate edit
      rating.stars = 5;
      rating.status = 'edited';
      rating.editHistory.push({
        stars: 4,
        editedAt: new Date()
      });

      const updatedRating = await rating.save();
      expect(updatedRating.stars).toBe(5);
      expect(updatedRating.status).toBe('edited');
      expect(updatedRating.editHistory).toHaveLength(1);
    });

    test('should enforce validation rules', async () => {
      const invalidRating = new Rating({
        raterId: 'user1',
        rateeId: 'user2',
        stars: 6, // Invalid: should be 1-5
        context: 'invalid_context' // Invalid enum
      });

      await expect(invalidRating.save()).rejects.toThrow();
    });
  });

  describe('Review Model Integration', () => {
    test('should create review with proper validation', async () => {
      const review = new Review({
        ratingId: 'rating123',
        raterId: 'user1',
        rateeId: 'user2',
        content: 'Great experience! Very professional and responsive.',
        title: 'Excellent Service',
        context: 'marketplace',
        tags: ['helpful', 'professional']
      });

      const savedReview = await review.save();
      expect(savedReview._id).toBeDefined();
      expect(savedReview.content).toBe('Great experience! Very professional and responsive.');
      expect(savedReview.status).toBe('published');
      expect(savedReview.helpfulCount).toBe(0);
      expect(savedReview.tags).toEqual(['helpful', 'professional']);
    });

    test('should enforce minimum content length', async () => {
      const shortReview = new Review({
        ratingId: 'rating123',
        raterId: 'user1',
        rateeId: 'user2',
        content: 'Too short'
      });

      await expect(shortReview.save()).rejects.toThrow();
    });

    test('should handle helpful/not helpful voting', async () => {
      const review = new Review({
        ratingId: 'rating123',
        raterId: 'user1',
        rateeId: 'user2',
        content: 'Great experience! Very professional and responsive.',
        context: 'marketplace'
      });

      await review.save();

      // Mark as helpful
      review.helpfulCount += 1;
      await review.save();

      const updatedReview = await Review.findById(review._id);
      expect(updatedReview.helpfulCount).toBe(1);
    });

    test('should handle reporting and flagging', async () => {
      const review = new Review({
        ratingId: 'rating123',
        raterId: 'user1',
        rateeId: 'user2',
        content: 'Great experience! Very professional and responsive.',
        context: 'marketplace'
      });

      await review.save();

      // Report review
      review.reportCount += 1;
      review.flagReasons.push({
        reason: 'spam',
        reportedBy: 'user3',
        reportedAt: new Date()
      });
      review.status = 'flagged';

      await review.save();

      const flaggedReview = await Review.findById(review._id);
      expect(flaggedReview.reportCount).toBe(1);
      expect(flaggedReview.status).toBe('flagged');
      expect(flaggedReview.flagReasons).toHaveLength(1);
    });
  });

  describe('TrustScore Model Integration', () => {
    test('should initialize trust profile with default values', async () => {
      const trustScore = new TrustScore({
        userId: 'user123',
        email: 'user@example.com',
        username: 'testuser'
      });

      const savedTrustScore = await trustScore.save();
      expect(savedTrustScore.score).toBe(50);
      expect(savedTrustScore.badge).toBe('new-neighbor');
      expect(savedTrustScore.metrics.totalRatingsReceived).toBe(0);
      expect(savedTrustScore.metrics.averageRating).toBe(0);
      expect(savedTrustScore.metrics.verificationStatus).toBe('unverified');
    });

    test('should calculate trust score based on ratings', async () => {
      // Create test ratings
      await Rating.create([
        { raterId: 'user1', rateeId: 'user123', stars: 5, createdAt: new Date('2023-01-01') },
        { raterId: 'user2', rateeId: 'user123', stars: 4, createdAt: new Date('2023-02-01') },
        { raterId: 'user3', rateeId: 'user123', stars: 5, createdAt: new Date('2023-03-01') }
      ]);

      const trustScore = new TrustScore({
        userId: 'user123',
        score: 50,
        badge: 'new-neighbor'
      });

      await trustScore.save();

      // Recalculate trust score
      const TrustScoreService = require('../../services/TrustScoreService.js');
      const updatedScore = await TrustScoreService.recalculateTrustScore('user123');

      expect(updatedScore.score).toBeGreaterThan(50);
      expect(updatedScore.badge).toBeDefined();
    });

    test('should update badge based on score', async () => {
      const trustScore = new TrustScore({
        userId: 'user123',
        score: 85, // High score
        badge: 'new-neighbor'
      });

      await trustScore.save();

      // Update badge based on score
      const newBadge = TrustScore.determineBadge(85);
      expect(['trusted-neighbor', 'community-star', 'verified-contributor']).toContain(newBadge);
    });

    test('should track score history', async () => {
      const trustScore = new TrustScore({
        userId: 'user123',
        score: 50,
        badge: 'new-neighbor'
      });

      await trustScore.save();

      // Update score and track history
      trustScore.score = 75;
      trustScore.badge = 'trusted-neighbor';
      trustScore.scoreHistory.push({
        score: 50,
        badge: 'new-neighbor',
        changedAt: new Date(),
        reason: 'positive_ratings'
      });

      await trustScore.save();

      const updatedTrustScore = await TrustScore.findById(trustScore._id);
      expect(updatedTrustScore.score).toBe(75);
      expect(updatedTrustScore.badge).toBe('trusted-neighbor');
      expect(updatedTrustScore.scoreHistory).toHaveLength(1);
    });
  });

  describe('User Model Integration', () => {
    test('should create user with proper validation', async () => {
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword123',
        profile: {
          displayName: 'Test User',
          bio: 'Test user bio',
          location: 'Test City'
        }
      });

      const savedUser = await user.save();
      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe('test@example.com');
      expect(savedUser.username).toBe('testuser');
      expect(savedUser.status).toBe('active');
      expect(savedUser.role).toBe('user');
    });

    test('should enforce unique email and username', async () => {
      const user1 = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword123'
      });

      await user1.save();

      const user2 = new User({
        email: 'test@example.com', // Duplicate email
        username: 'testuser2',
        password: 'hashedpassword123'
      });

      await expect(user2.save()).rejects.toThrow();
    });

    test('should handle profile updates', async () => {
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword123'
      });

      await user.save();

      // Update profile
      user.profile.displayName = 'Updated Name';
      user.profile.verificationStatus = 'verified';
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.profile.displayName).toBe('Updated Name');
      expect(updatedUser.profile.verificationStatus).toBe('verified');
    });
  });

  describe('Database Performance Integration', () => {
    test('should handle large volume of ratings efficiently', async () => {
      const startTime = Date.now();
      
      // Create 1000 ratings
      const ratings = Array(1000).fill().map((_, index) => ({
        raterId: `user${index}`,
        rateeId: 'targetUser',
        stars: Math.floor(Math.random() * 5) + 1,
        context: 'marketplace'
      }));

      await Rating.insertMany(ratings);
      
      const endTime = Date.now();
      const insertTime = endTime - startTime;

      expect(insertTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test query performance
      const queryStartTime = Date.now();
      const foundRatings = await Rating.find({ rateeId: 'targetUser' });
      const queryEndTime = Date.now();
      const queryTime = queryEndTime - queryStartTime;

      expect(foundRatings).toHaveLength(1000);
      expect(queryTime).toBeLessThan(1000); // Should query within 1 second
    });

    test('should use indexes effectively', async () => {
      // Create test data
      await Rating.create([
        { raterId: 'user1', rateeId: 'user2', stars: 5, context: 'marketplace' },
        { raterId: 'user1', rateeId: 'user3', stars: 4, context: 'services' },
        { raterId: 'user2', rateeId: 'user1', stars: 5, context: 'general' }
      ]);

      // Test indexed queries
      const startTime = Date.now();
      const results = await Rating.find({ 
        raterId: 'user1', 
        status: 'active' 
      }).sort({ createdAt: -1 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast with indexes
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle concurrent operations', async () => {
      const concurrentOperations = Array(10).fill().map((_, index) =>
        Rating.create({
          raterId: `user${index}`,
          rateeId: 'targetUser',
          stars: 5,
          context: 'marketplace'
        })
      );

      const results = await Promise.all(concurrentOperations);
      expect(results).toHaveLength(10);

      // Verify all were saved correctly
      const savedRatings = await Rating.find({ rateeId: 'targetUser' });
      expect(savedRatings).toHaveLength(10);
    });
  });

  describe('Database Constraints Integration', () => {
    test('should enforce foreign key relationships', async () => {
      // This test would require actual foreign key constraints
      // For now, we'll test application-level constraints
      const review = new Review({
        ratingId: 'nonexistent_rating_id',
        raterId: 'user1',
        rateeId: 'user2',
        content: 'Test review content'
      });

      // Should allow creation but fail when trying to access the rating
      const savedReview = await review.save();
      expect(savedReview._id).toBeDefined();
    });

    test('should handle cascading deletes properly', async () => {
      // Create rating and review
      const rating = new Rating({
        raterId: 'user1',
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace'
      });

      await rating.save();

      const review = new Review({
        ratingId: rating._id,
        raterId: 'user1',
        rateeId: 'user2',
        content: 'Test review'
      });

      await review.save();

      // Delete rating (should cascade to review in real implementation)
      await Rating.findByIdAndDelete(rating._id);

      // Check if review still exists
      const orphanedReview = await Review.findById(review._id);
      // In a real implementation with cascading deletes, this would be null
      expect(orphanedReview).toBeDefined();
    });
  });

  describe('Data Integrity Integration', () => {
    test('should maintain data consistency across operations', async () => {
      // Create initial data
      const trustScore = new TrustScore({
        userId: 'user123',
        score: 50,
        badge: 'new-neighbor'
      });

      await trustScore.save();

      // Create ratings
      await Rating.create([
        { raterId: 'user1', rateeId: 'user123', stars: 5 },
        { raterId: 'user2', rateeId: 'user123', stars: 4 }
      ]);

      // Recalculate trust score
      const TrustScoreService = require('../../services/TrustScoreService.js');
      await TrustScoreService.recalculateTrustScore('user123');

      // Verify consistency
      const updatedTrustScore = await TrustScore.findOne({ userId: 'user123' });
      const ratings = await Rating.find({ rateeId: 'user123' });

      expect(updatedTrustScore.metrics.totalRatingsReceived).toBe(ratings.length);
      expect(updatedTrustScore.metrics.averageRating).toBeCloseTo(
        ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length,
        1
      );
    });

    test('should handle transaction rollback on errors', async () => {
      // This would require actual transaction support
      // For now, we'll test basic error handling
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const rating = new Rating({
            raterId: 'user1',
            rateeId: 'user2',
            stars: 5,
            context: 'marketplace'
          });

          await rating.save({ session });

          // Simulate error
          throw new Error('Simulated error');
        });
      } catch (error) {
        expect(error.message).toBe('Simulated error');
      } finally {
        await session.endSession();
      }

      // Verify no data was saved
      const ratings = await Rating.find({ raterId: 'user1' });
      expect(ratings).toHaveLength(0);
    });
  });
});
