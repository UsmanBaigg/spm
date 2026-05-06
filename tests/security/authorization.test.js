/**
 * Authorization Security Tests
 * Tests for role-based access control, permissions, and security policies
 */

import request from 'supertest';
import { expect } from 'chai';

describe('Authorization Security Tests', () => {
  let app;
  let users = {};

  before(async () => {
    app = require('../../server');
    
    // Create test users with different roles
    users = {
      guest: null, // Unauthenticated
      user: {
        email: 'user@example.com',
        password: 'SecurePassword123!',
        role: 'user'
      },
      trusted_user: {
        email: 'trusted@example.com',
        password: 'SecurePassword123!',
        role: 'trusted_user'
      },
      moderator: {
        email: 'moderator@example.com',
        password: 'SecurePassword123!',
        role: 'moderator'
      },
      admin: {
        email: 'admin@example.com',
        password: 'SecurePassword123!',
        role: 'admin'
      },
      super_admin: {
        email: 'superadmin@example.com',
        password: 'SecurePassword123!',
        role: 'super_admin'
      }
    };

    // Register and login users
    for (const [role, userData] of Object.entries(users)) {
      if (userData) {
        await request(app)
          .post('/api/v1/auth/register')
          .send(userData)
          .expect(201);

        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: userData.email,
            password: userData.password
          })
          .expect(200);

        userData.token = loginResponse.body.data.tokens.accessToken;
      }
    }
  });

  describe('Role-Based Access Control', () => {
    it('should deny access to unauthenticated users for protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'GET', path: '/api/v1/profile' },
        { method: 'POST', path: '/api/v1/ratings/submit' },
        { method: 'POST', path: '/api/v1/reviews/create' },
        { method: 'GET', path: '/api/v1/admin/users' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .expect(401);

        expect(response.body.error).to.include('Unauthorized');
      }
    });

    it('should allow basic users to access their own resources', async () => {
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(response.body.data).to.exist;
      expect(response.body.data.email).to.equal(users.user.email);
    });

    it('should prevent users from accessing other users\' resources', async () => {
      const response = await request(app)
        .get('/api/v1/users/other-user-id')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(403);

      expect(response.body.error).to.include('Forbidden');
    });

    it('should allow moderators to moderate content', async () => {
      const response = await request(app)
        .post('/api/v1/moderation/review')
        .set('Authorization', `Bearer ${users.moderator.token}`)
        .send({
          reviewId: 'test-review-id',
          action: 'approve'
        })
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should deny moderation access to regular users', async () => {
      const response = await request(app)
        .post('/api/v1/moderation/review')
        .set('Authorization', `Bearer ${users.user.token}`)
        .send({
          reviewId: 'test-review-id',
          action: 'approve'
        })
        .expect(403);

      expect(response.body.error).to.include('Forbidden');
    });

    it('should allow admins to manage users', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(response.body.data).to.be.an('array');
    });

    it('should deny admin access to moderators', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${users.moderator.token}`)
        .expect(403);

      expect(response.body.error).to.include('Forbidden');
    });

    it('should allow super admins full system access', async () => {
      const response = await request(app)
        .get('/api/v1/system/config')
        .set('Authorization', `Bearer ${users.super_admin.token}`)
        .expect(200);

      expect(response.body.data).to.exist;
    });

    it('should prevent privilege escalation through token manipulation', async () => {
      // Try to modify JWT token to escalate privileges
      const modifiedToken = users.user.token.replace('"role":"user"', '"role":"admin"');

      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${modifiedToken}`)
        .expect(401);

      expect(response.body.error).to.include('Unauthorized');
    });
  });

  describe('Permission-Based Access Control', () => {
    it('should enforce read permissions correctly', async () => {
      const readEndpoints = [
        '/api/v1/ratings/user123',
        '/api/v1/reviews/user123',
        '/api/v1/trust/user123'
      ];

      for (const endpoint of readEndpoints) {
        // All authenticated users should be able to read
        const userResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(userResponse.body.data).to.exist;
      }
    });

    it('should enforce write permissions correctly', async () => {
      const writeData = {
        raterId: 'user123',
        rateeId: 'user456',
        stars: 5,
        context: 'marketplace'
      };

      // Users should be able to write ratings
      const userResponse = await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${users.user.token}`)
        .send(writeData)
        .expect(201);

      expect(userResponse.body.success).to.be.true;
    });

    it('should enforce delete permissions correctly', async () => {
      // Only moderators and admins should be able to delete content
      const userResponse = await request(app)
        .delete('/api/v1/reviews/test-review-id')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(403);

      expect(userResponse.body.error).to.include('Forbidden');

      // Moderator should be able to delete
      const moderatorResponse = await request(app)
        .delete('/api/v1/reviews/test-review-id')
        .set('Authorization', `Bearer ${users.moderator.token}`)
        .expect(200);

      expect(moderatorResponse.body.success).to.be.true;
    });

    it('should handle permission inheritance correctly', async () => {
      // Trusted users should have all user permissions plus additional ones
      const trustedResponse = await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${users.trusted_user.token}`)
        .send({
          raterId: 'user123',
          rateeId: 'user456',
          stars: 5,
          context: 'services'
        })
        .expect(201);

      expect(trustedResponse.body.success).to.be.true;
    });
  });

  describe('Resource-Based Access Control', () => {
    it('should prevent unauthorized data access', async () => {
      const sensitiveData = [
        '/api/v1/admin/analytics',
        '/api/v1/admin/security-logs',
        '/api/v1/admin/audit-logs',
        '/api/v1/system/metrics'
      ];

      for (const endpoint of sensitiveData) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(403);

        expect(response.body.error).to.include('Forbidden');
      }
    });

    it('should allow authorized data access', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(response.body.data).to.exist;
    });

    it('should implement ownership-based access control', async () => {
      // Create a rating as user
      const createResponse = await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${users.user.token}`)
        .send({
          raterId: 'user123',
          rateeId: 'user456',
          stars: 4,
          context: 'marketplace'
        })
        .expect(201);

      const ratingId = createResponse.body.data.id;

      // User should be able to edit their own rating
      const editResponse = await request(app)
        .put(`/api/v1/ratings/${ratingId}`)
        .set('Authorization', `Bearer ${users.user.token}`)
        .send({ stars: 5 })
        .expect(200);

      expect(editResponse.body.success).to.be.true;

      // Another user should not be able to edit it
      const otherUserResponse = await request(app)
        .put(`/api/v1/ratings/${ratingId}`)
        .set('Authorization', `Bearer ${users.trusted_user.token}`)
        .send({ stars: 3 })
        .expect(403);

      expect(otherUserResponse.body.error).to.include('Forbidden');
    });
  });

  describe('API Key Authorization', () => {
    let apiKey;

    before(async () => {
      // Create API key for testing
      const keyResponse = await request(app)
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .send({
          name: 'Test API Key',
          type: 'readwrite',
          purpose: 'Security testing'
        })
        .expect(201);

      apiKey = keyResponse.body.data.apiKey;
    });

    it('should authorize requests with valid API keys', async () => {
      const response = await request(app)
        .get('/api/v1/ratings/user123')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.data).to.exist;
    });

    it('should reject requests with invalid API keys', async () => {
      const invalidKeys = [
        'invalid-key',
        '',
        null,
        'tr_invalid_key_format'
      ];

      for (const key of invalidKeys) {
        const response = await request(app)
          .get('/api/v1/ratings/user123')
          .set('X-API-Key', key)
          .expect(401);

        expect(response.body.error).to.include('Unauthorized');
      }
    });

    it('should enforce API key permissions', async () => {
      // Create read-only API key
      const readOnlyKeyResponse = await request(app)
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .send({
          name: 'Read-only Key',
          type: 'readonly',
          purpose: 'Testing'
        })
        .expect(201);

      const readOnlyKey = readOnlyKeyResponse.body.data.apiKey;

      // Should be able to read
      const readResponse = await request(app)
        .get('/api/v1/ratings/user123')
        .set('X-API-Key', readOnlyKey)
        .expect(200);

      expect(readResponse.body.data).to.exist;

      // Should not be able to write
      const writeResponse = await request(app)
        .post('/api/v1/ratings/submit')
        .set('X-API-Key', readOnlyKey)
        .send({
          raterId: 'user123',
          rateeId: 'user456',
          stars: 5,
          context: 'marketplace'
        })
        .expect(403);

      expect(writeResponse.body.error).to.include('Forbidden');
    });

    it('should enforce API key rate limits', async () => {
      // Make many requests to test rate limiting
      const responses = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/v1/ratings/user123')
          .set('X-API-Key', apiKey);
        
        responses.push(response.status);
      }

      // Should eventually be rate limited
      expect(responses.some(status => status === 429)).to.be.true;
    });
  });

  describe('Cross-Site Request Forgery Protection', () => {
    it('should require CSRF tokens for state-changing requests', async () => {
      // Get CSRF token
      const csrfResponse = await request(app)
        .get('/api/v1/csrf-token')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const csrfToken = csrfResponse.body.data.token;

      // Make request without CSRF token
      const response = await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${users.user.token}`)
        .send({
          raterId: 'user123',
          rateeId: 'user456',
          stars: 5,
          context: 'marketplace'
        })
        .expect(403);

      expect(response.body.error).to.include('CSRF');

      // Make request with CSRF token
      const validResponse = await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${users.user.token}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          raterId: 'user123',
          rateeId: 'user456',
          stars: 5,
          context: 'marketplace'
        })
        .expect(201);

      expect(validResponse.body.success).to.be.true;
    });

    it('should reject invalid CSRF tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        '',
        'malformed.token.format'
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${users.user.token}`)
          .set('X-CSRF-Token', token)
          .send({
            raterId: 'user123',
            rateeId: 'user456',
            stars: 5,
            context: 'marketplace'
          })
          .expect(403);

        expect(response.body.error).to.include('CSRF');
      }
    });
  });

  describe('Security Headers and Policies', () => {
    it('should set proper security headers', async () => {
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      // Check security headers
      expect(response.headers['x-frame-options']).to.equal('DENY');
      expect(response.headers['x-content-type-options']).to.equal('nosniff');
      expect(response.headers['x-xss-protection']).to.equal('1; mode=block');
      expect(response.headers['strict-transport-security']).to.exist;
      expect(response.headers['referrer-policy']).to.exist;
    });

    it('should implement Content Security Policy', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-security-policy']).to.exist;
      
      const csp = response.headers['content-security-policy'];
      expect(csp).to.include("default-src 'self'");
      expect(csp).to.include("script-src 'self'");
      expect(csp).to.include("style-src 'self'");
    });

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(response.headers['x-frame-options']).to.equal('DENY');
      expect(response.headers['content-security-policy']).to.include("frame-ancestors 'none'");
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate and sanitize user inputs', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
        '${7*7}', // Template injection
        '{{7*7}}', // Template injection
        'SELECT * FROM users', // SQL injection attempt
        '../../etc/passwd', // Path traversal
        '\x00\x01\x02', // Null bytes
        '🚀🔥💀', // Unicode attacks
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/v1/reviews/create')
          .set('Authorization', `Bearer ${users.user.token}`)
          .send({
            targetId: 'user123',
            content: input,
            rating: 5
          });

        // Should either reject (400) or sanitize (200)
        expect(response.status).to.be.oneOf([400, 200]);
        
        if (response.status === 200) {
          // If accepted, content should be sanitized
          expect(response.body.data.content).to.not.include('<script>');
          expect(response.body.data.content).to.not.include('javascript:');
        }
      }
    });

    it('should validate file uploads', async () => {
      const maliciousFiles = [
        { name: 'malicious.exe', mimetype: 'application/octet-stream' },
        { name: 'script.php', mimetype: 'application/x-php' },
        { name: '../../etc/passwd', mimetype: 'text/plain' },
        { name: 'file with spaces.exe', mimetype: 'application/octet-stream' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/v1/upload')
          .set('Authorization', `Bearer ${users.user.token}`)
          .attach('file', Buffer.from('fake content'), file.name)
          .expect(400);

        expect(response.body.error).to.include('file');
      }
    });

    it('should enforce request size limits', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await request(app)
        .post('/api/v1/reviews/create')
        .set('Authorization', `Bearer ${users.user.token}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          targetId: 'user123',
          content: largePayload,
          rating: 5
        }))
        .expect(413);

      expect(response.body.error).to.include('too large');
    });
  });

  after(async () => {
    // Cleanup test data
    for (const [role, userData] of Object.entries(users)) {
      if (userData && userData.token) {
        await request(app)
          .delete('/api/v1/account')
          .set('Authorization', `Bearer ${userData.token}`);
      }
    }
  });
});
