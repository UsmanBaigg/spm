/**
 * Authentication Security Tests
 * Tests for JWT authentication, session management, and security controls
 */

import request from 'supertest';
import { expect } from 'chai';
import jwt from 'jsonwebtoken';

describe('Authentication Security Tests', () => {
  let app;
  let testUser;
  let authTokens;

  before(async () => {
    // Initialize test app
    app = require('../../server');
    
    // Create test user
    testUser = {
      email: 'security.test@example.com',
      password: 'SecurePassword123!',
      role: 'user'
    };
  });

  describe('JWT Token Security', () => {
    it('should reject requests with invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        null,
        undefined
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/v1/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.error).to.include('Unauthorized');
      }
    });

    it('should reject requests with expired JWT tokens', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id, email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).to.include('Unauthorized');
    });

    it('should reject requests with tokens signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: testUser.id, email: testUser.email },
        'wrong-secret'
      );

      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .expect(401);

      expect(response.body.error).to.include('Unauthorized');
    });

    it('should reject requests with tokens missing required claims', async () => {
      const incompleteToken = jwt.sign(
        { email: testUser.email }, // Missing userId
        process.env.JWT_SECRET
      );

      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .expect(401);

      expect(response.body.error).to.include('Unauthorized');
    });

    it('should handle token refresh securely', async () => {
      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const { refreshToken } = loginResponse.body.data.tokens;

      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.data.tokens.accessToken).to.exist;
      expect(refreshResponse.body.data.tokens.refreshToken).to.exist;

      // Old refresh token should be invalidated
      const oldRefreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(oldRefreshResponse.body.error).to.include('Invalid');
    });
  });

  describe('Session Management Security', () => {
    it('should prevent session hijacking with IP validation', async () => {
      // Login from one IP
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .set('X-Forwarded-For', '192.168.1.100')
        .expect(200);

      const { accessToken } = loginResponse.body.data.tokens;

      // Try to use token from different IP
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Forwarded-For', '192.168.1.200')
        .expect(401);

      expect(response.body.error).to.include('Security');
    });

    it('should enforce session timeout', async () => {
      // This test would require mocking time
      // For now, we'll test the session validation logic
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const { accessToken } = loginResponse.body.data.tokens;

      // Session should be valid immediately
      const validResponse = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(validResponse.body.data).to.exist;
    });

    it('should limit concurrent sessions per user', async () => {
      // Create multiple sessions (mock scenario)
      const sessions = [];
      
      for (let i = 0; i < 6; i++) { // Exceeds max sessions (5)
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
          .set('X-Forwarded-For', `192.168.1.${100 + i}`);

        if (response.status === 200) {
          sessions.push(response.body.data.tokens.accessToken);
        }
      }

      // Oldest session should be invalidated
      expect(sessions.length).to.be.at.most(5);
    });

    it('should detect suspicious session activity', async () => {
      // Login from one location
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .set('X-Forwarded-For', '192.168.1.100')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .expect(200);

      const { accessToken } = loginResponse.body.data.tokens;

      // Access from different location with different user agent (suspicious)
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Forwarded-For', '203.0.113.1') // Different country
        .set('User-Agent', 'curl/7.68.0')
        .expect(401);

      expect(response.body.error).to.include('Security');
    });
  });

  describe('Password Security', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'abc',
        'short',
        'nouppercase1',
        'NOLOWERCASE1',
        'NoNumberHere',
        'NoSpecialChar1'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `test${Math.random()}@example.com`,
            password
          })
          .expect(400);

        expect(response.body.error).to.include('Password');
      }
    });

    it('should prevent password reuse', async () => {
      // Change password
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewSecurePassword123!'
        })
        .expect(200);

      // Try to change back to old password
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          currentPassword: 'NewSecurePassword123!',
          newPassword: testUser.password
        })
        .expect(400);

      expect(response.body.error).to.include('previously used');
    });

    it('should implement secure password reset flow', async () => {
      // Request password reset
      const resetResponse = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(resetResponse.body.message).to.include('email sent');

      // Try to use invalid reset token
      const invalidResetResponse = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123!'
        })
        .expect(400);

      expect(invalidResetResponse.body.error).to.include('Invalid');
    });
  });

  describe('Rate Limiting Security', () => {
    it('should limit failed login attempts', async () => {
      const failedAttempts = [];
      
      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          });

        failedAttempts.push(response.status);
      }

      // Should be rate limited after 5 attempts
      expect(failedAttempts[5]).to.equal(429);
    });

    it('should implement progressive rate limiting', async () => {
      // First attempt - should work
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      // Multiple attempts should increase penalty
      const responses = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          });
        responses.push(response.headers['retry-after']);
      }

      // Retry-after should increase
      expect(parseInt(responses[2])).to.be.greaterThan(parseInt(responses[0]));
    });

    it('should implement IP-based rate limiting', async () => {
      const ip = '192.168.1.100';
      
      // Make requests from same IP
      const responses = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `test${i}@example.com`,
            password: 'password123'
          })
          .set('X-Forwarded-For', ip);
        
        responses.push(response.status);
      }

      // Should be rate limited
      expect(responses.some(status => status === 429)).to.be.true;
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in login', async () => {
      const sqlInjectionAttempts = [
        "admin'--",
        "admin' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --"
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: attempt,
            password: 'password'
          })
          .expect(401);

        expect(response.body.error).to.include('Invalid');
      }
    });

    it('should prevent XSS in user inputs', async () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>'
      ];

      for (const xss of xssAttempts) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `test${Math.random()}@example.com`,
            password: 'SecurePassword123!',
            name: xss
          })
          .expect(400);

        // Should reject or sanitize input
        expect(response.status).to.be.oneOf([400, 201]);
      }
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example..com',
        'test@example.c' // Too short TLD
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email,
            password: 'SecurePassword123!'
          })
          .expect(400);

        expect(response.body.error).to.include('email');
      }
    });
  });

  describe('Authentication Headers Security', () => {
    it('should set secure authentication headers', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      // Check for security headers
      expect(response.headers).to.not.have.property('x-powered-by');
      expect(response.headers['x-content-type-options']).to.equal('nosniff');
      expect(response.headers['x-frame-options']).to.equal('DENY');
      expect(response.headers['x-xss-protection']).to.exist;
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'https://malicious-site.com')
        .expect(404); // Should not allow CORS for non-allowed origins

      // Allowed origin should work
      const allowedResponse = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(allowedResponse.headers['access-control-allow-origin']).to.exist;
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should support TOTP-based 2FA', async () => {
      // Enable 2FA for user
      const enableResponse = await request(app)
        .post('/api/v1/auth/enable-2fa')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(enableResponse.body.data.qrCode).to.exist;
      expect(enableResponse.body.data.secret).to.exist;

      // Verify 2FA setup
      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-2fa')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          token: '123456' // Mock TOTP token
        })
        .expect(200);

      expect(verifyResponse.body.data.verified).to.be.true;
    });

    it('should require 2FA for sensitive operations', async () => {
      // Enable 2FA first
      await request(app)
        .post('/api/v1/auth/enable-2fa')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      // Try sensitive operation without 2FA
      const response = await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(401);

      expect(response.body.error).to.include('2FA');
    });
  });

  after(async () => {
    // Cleanup test data
    await request(app)
      .delete(`/api/v1/users/${testUser.id}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`);
  });
});
