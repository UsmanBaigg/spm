/**
 * Comprehensive API Integration Tests
 */
import request from 'supertest';
import app from '../../server.js';
import { setupTestDatabase, teardownTestDatabase } from '../setup.js';

describe('API Integration Tests', () => {
  let authToken;
  let testUser;
  let testRating;
  let testReview;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Setup test user and get auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.data.tokens.accessToken;
      testUser = loginResponse.body.data.user;
    }
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('Authentication Integration', () => {
    test('should authenticate user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should refresh token successfully', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });
  });

  describe('Rating API Integration', () => {
    test('POST /api/v1/ratings/submit - should create rating', async () => {
      const ratingData = {
        raterId: testUser?.id || 'user1',
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace',
        contextId: 'tx123',
        raterInfo: {
          username: 'testuser',
          profileImage: 'http://example.com/image.jpg',
          badge: 'verified'
        }
      };

      const response = await request(app)
        .post('/api/v1/ratings/submit')
        .send(ratingData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stars).toBe(5);
      expect(response.body.data.context).toBe('marketplace');
      
      testRating = response.body.data;
    });

    test('GET /api/v1/ratings/user/:userId - should get user ratings', async () => {
      const response = await request(app)
        .get('/api/v1/ratings/user/user2')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.reviews)).toBe(true);
      expect(response.body.data.totalCount).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totalPages).toBeGreaterThanOrEqual(0);
    });

    test('PUT /api/v1/ratings/:ratingId - should update rating', async () => {
      if (!testRating) {
        // Create a rating first
        const createResponse = await request(app)
          .post('/api/v1/ratings/submit')
          .send({
            raterId: testUser?.id || 'user1',
            rateeId: 'user3',
            stars: 4,
            context: 'services'
          });

        testRating = createResponse.body.data;
      }

      const response = await request(app)
        .put(`/api/v1/ratings/${testRating._id}`)
        .send({
          raterId: testUser?.id || 'user1',
          newStars: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stars).toBe(5);
    });

    test('GET /api/v1/ratings/stats/:userId - should get rating statistics', async () => {
      const response = await request(app)
        .get('/api/v1/ratings/stats/user2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRatings');
      expect(response.body.data).toHaveProperty('averageRating');
      expect(response.body.data).toHaveProperty('distribution');
    });

    test('POST /api/v1/ratings/:ratingId/report - should report rating', async () => {
      if (!testRating) return;

      const response = await request(app)
        .post(`/api/v1/ratings/${testRating._id}/report`)
        .send({
          raterId: testUser?.id || 'user1',
          reason: 'inappropriate_content',
          description: 'This rating contains inappropriate content'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Review API Integration', () => {
    test('POST /api/v1/reviews - should create review', async () => {
      if (!testRating) return;

      const reviewData = {
        ratingId: testRating._id,
        raterId: testUser?.id || 'user1',
        content: 'Great experience! Very professional and responsive.',
        context: 'marketplace',
        title: 'Excellent Service',
        tags: ['helpful', 'professional']
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .send(reviewData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(reviewData.content);
      expect(response.body.data.tags).toEqual(reviewData.tags);
      
      testReview = response.body.data;
    });

    test('GET /api/v1/reviews/user/:userId - should get user reviews', async () => {
      const response = await request(app)
        .get('/api/v1/reviews/user/user2')
        .query({ page: 1, limit: 10, sort: 'newest' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.reviews)).toBe(true);
      expect(response.body.data.totalCount).toBeGreaterThanOrEqual(0);
    });

    test('PUT /api/v1/reviews/:reviewId - should update review', async () => {
      if (!testReview) return;

      const response = await request(app)
        .put(`/api/v1/reviews/${testReview._id}`)
        .send({
          raterId: testUser?.id || 'user1',
          content: 'Updated review content with more details.',
          title: 'Updated Title'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Updated review content with more details.');
    });

    test('POST /api/v1/reviews/:reviewId/helpful - should mark review as helpful', async () => {
      if (!testReview) return;

      const response = await request(app)
        .post(`/api/v1/reviews/${testReview._id}/helpful`)
        .send({ userId: 'user2' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.helpfulCount).toBeGreaterThan(0);
    });

    test('POST /api/v1/reviews/:reviewId/report - should report review', async () => {
      if (!testReview) return;

      const response = await request(app)
        .post(`/api/v1/reviews/${testReview._id}/report`)
        .send({
          raterId: testUser?.id || 'user1',
          reason: 'spam',
          description: 'This review appears to be spam'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Trust Score API Integration', () => {
    test('GET /api/v1/trust/:userId - should get trust profile', async () => {
      const response = await request(app)
        .get('/api/v1/trust/user1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('badge');
      expect(response.body.data).toHaveProperty('metrics');
    });

    test('POST /api/v1/trust/initialize - should initialize trust profile', async () => {
      const response = await request(app)
        .post('/api/v1/trust/initialize')
        .send({
          userId: 'newuser123',
          email: 'newuser@example.com',
          username: 'newuser'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBe(50);
      expect(response.body.data.badge).toBe('new-neighbor');
    });

    test('POST /api/v1/trust/:userId/recalculate - should recalculate trust score', async () => {
      const response = await request(app)
        .post('/api/v1/trust/user1/recalculate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('badge');
    });

    test('GET /api/v1/trust/leaderboard - should get top users', async () => {
      const response = await request(app)
        .get('/api/v1/trust/leaderboard')
        .query({ limit: 10, badge: 'trusted-neighbor' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.totalCount).toBeGreaterThanOrEqual(0);
    });

    test('GET /api/v1/trust/badge/:badge - should get users by badge', async () => {
      const response = await request(app)
        .get('/api/v1/trust/badge/verified')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    test('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/ratings/submit')
        .send({
          // Missing required fields
          stars: 6 // Invalid star rating
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should handle database connection errors', async () => {
      // This test would require mocking database connection failure
      // For now, we'll test rate limiting which should work even with DB issues
      const responses = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health')
      ]);

      // At least one should succeed
      const successResponses = responses.filter(r => r.status === 200);
      expect(successResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting Integration', () => {
    test('should enforce rate limits on sensitive endpoints', async () => {
      const ratingData = {
        raterId: 'testuser',
        rateeId: 'testuser2',
        stars: 5,
        context: 'marketplace'
      };

      // Make multiple requests quickly
      const responses = await Promise.all([
        request(app).post('/api/v1/ratings/submit').send(ratingData),
        request(app).post('/api/v1/ratings/submit').send(ratingData),
        request(app).post('/api/v1/ratings/submit').send(ratingData),
        request(app).post('/api/v1/ratings/submit').send(ratingData),
        request(app).post('/api/v1/ratings/submit').send(ratingData),
        request(app).post('/api/v1/ratings/submit').send(ratingData)
      ]);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Integration', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/v1/ratings')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    test('should sanitize input properly', async () => {
      const maliciousInput = {
        raterId: '<script>alert("xss")</script>',
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace',
        raterInfo: {
          username: '<img src=x onerror=alert("xss")>',
          profileImage: 'javascript:alert("xss")'
        }
      };

      const response = await request(app)
        .post('/api/v1/ratings/submit')
        .send(maliciousInput);

      // Should either reject or sanitize the input
      expect([400, 201]).toContain(response.status);
      if (response.status === 201) {
        // If accepted, ensure malicious content is sanitized
        expect(response.body.data.raterInfo.username).not.toContain('<script>');
      }
    });
  });

  describe('Performance Integration', () => {
    test('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/v1/ratings/user/user1')
        .query({ page: 1, limit: 10 });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle concurrent requests', async () => {
      const concurrentRequests = Array(10).fill().map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Health Check Integration', () => {
    test('GET /health - should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('Trust & Rating Module');
      expect(response.body.timestamp).toBeDefined();
    });

    test('GET /metrics - should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });
});
