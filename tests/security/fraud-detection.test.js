/**
 * Fraud Detection Security Tests
 * Tests for fraud detection algorithms and suspicious activity monitoring
 */

import request from 'supertest';
import { expect } from 'chai';

describe('Fraud Detection Security Tests', () => {
  let app;
  let testUsers = [];

  before(async () => {
    app = require('../../server');
    
    // Create test users for fraud testing
    for (let i = 0; i < 5; i++) {
      const userData = {
        email: `fraudtest${i}@example.com`,
        password: 'SecurePassword123!',
        role: 'user'
      };

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

      testUsers.push({
        ...userData,
        token: loginResponse.body.data.tokens.accessToken
      });
    }
  });

  describe('Rating Fraud Detection', () => {
    it('should detect perfect score patterns', async () => {
      const user = testUsers[0];
      
      // Submit multiple perfect ratings
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            raterId: user.email,
            rateeId: `target${i}`,
            stars: 5, // Always perfect
            context: 'marketplace'
          })
          .expect(201);
      }

      // Check if user is flagged for suspicious activity
      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data.riskScore).to.be.greaterThan(50);
      expect(response.body.data.suspiciousPatterns).to.include('perfect_scores');
    });

    it('should detect rapid rating patterns', async () => {
      const user = testUsers[1];
      
      // Submit ratings very quickly (within seconds)
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            raterId: user.email,
            rateeId: `rapid${i}`,
            stars: 4,
            context: 'services'
          })
          .expect(201);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // If completed too quickly, should be flagged
      if (duration < 10000) { // Less than 10 seconds
        const riskResponse = await request(app)
          .get('/api/v1/security/user-risk')
          .set('Authorization', `Bearer ${user.token}`)
          .expect(200);

        expect(riskResponse.body.data.suspiciousPatterns).to.include('rapid_ratings');
      }
    });

    it('should detect reciprocal rating patterns', async () => {
      const user1 = testUsers[2];
      const user2 = testUsers[3];
      
      // User1 rates User2 highly
      await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({
          raterId: user1.email,
          rateeId: user2.email,
          stars: 5,
          context: 'marketplace'
        })
        .expect(201);

      // User2 immediately rates User1 highly
      await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${user2.token}`)
        .send({
          raterId: user2.email,
          rateeId: user1.email,
          stars: 5,
          context: 'marketplace'
        })
        .expect(201);

      // Check for reciprocal rating detection
      const response = await request(app)
        .get('/api/v1/security/reciprocal-check')
        .send({
          user1: user1.email,
          user2: user2.email
        })
        .expect(200);

      expect(response.body.data.suspicious).to.be.true;
      expect(response.body.data.pattern).to.equal('reciprocal_ratings');
    });

    it('should detect same-day multiple ratings', async () => {
      const user = testUsers[4];
      const targetId = 'same-day-target';
      
      // Multiple ratings to same user on same day
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            raterId: user.email,
            rateeId: targetId,
            stars: 4,
            context: 'general'
          })
          .expect(201);
      }

      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data.suspiciousPatterns).to.include('same_day_multiple');
    });
  });

  describe('Review Fraud Detection', () => {
    it('should detect duplicate review content', async () => {
      const user = testUsers[0];
      const duplicateContent = 'Great product! Highly recommended!';
      
      // Submit same review multiple times
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/reviews/create')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            targetId: `duplicate${i}`,
            content: duplicateContent,
            rating: 5
          })
          .expect(201);
      }

      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data.suspiciousPatterns).to.include('duplicate_content');
    });

    it('should detect spam keywords in reviews', async () => {
      const user = testUsers[1];
      const spamContent = 'CLICK HERE for FREE MONEY! GUARANTEED WINNER! Limited time offer!';
      
      const response = await request(app)
        .post('/api/v1/reviews/create')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          targetId: 'spam-target',
          content: spamContent,
          rating: 5
        });

      // Should either be rejected or flagged
      if (response.status === 201) {
        // If accepted, check if flagged
        const riskResponse = await request(app)
          .get('/api/v1/security/user-risk')
          .set('Authorization', `Bearer ${user.token}`)
          .expect(200);

        expect(riskResponse.body.data.suspiciousPatterns).to.include('spam_keywords');
      } else {
        expect(response.status).to.equal(400);
        expect(response.body.error).to.include('spam');
      }
    });

    it('should detect unnatural language patterns', async () => {
      const user = testUsers[2];
      const unnaturalContent = 'Great product!!!! AMAZING!!! EXCELLENT SERVICE!!! 🚀🚀🚀🔥🔥🔥';
      
      await request(app)
        .post('/api/v1/reviews/create')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          targetId: 'unnatural-target',
          content: unnaturalContent,
          rating: 5
        })
        .expect(201);

      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data.suspiciousPatterns).to.include('unnatural_language');
    });

    it('should detect unusual review lengths', async () => {
      const user = testUsers[3];
      
      // Very short review
      const shortResponse = await request(app)
        .post('/api/v1/reviews/create')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          targetId: 'short-target',
          content: 'ok',
          rating: 3
        });

      if (shortResponse.status === 201) {
        const riskResponse = await request(app)
          .get('/api/v1/security/user-risk')
          .set('Authorization', `Bearer ${user.token}`)
          .expect(200);

        expect(riskResponse.body.data.suspiciousPatterns).to.include('unnatural_length');
      }
    });
  });

  describe('Account Behavior Fraud Detection', () => {
    it('should detect new account burst activity', async () => {
      // Create new account
      const newUser = {
        email: `newburst${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        role: 'user'
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: newUser.email,
          password: newUser.password
        })
        .expect(200);

      const token = loginResponse.body.data.tokens.accessToken;

      // Immediately submit many ratings
      for (let i = 0; i < 15; i++) {
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${token}`)
          .send({
            raterId: newUser.email,
            rateeId: `burst${i}`,
            stars: 4,
            context: 'marketplace'
          })
          .expect(201);
      }

      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.suspiciousPatterns).to.include('new_account_burst');
    });

    it('should detect VPN/proxy usage', async () => {
      const user = testUsers[4];
      
      // Simulate request from VPN IP
      const vpnIP = '192.168.100.1'; // Mock VPN IP
      
      await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${user.token}`)
        .set('X-Forwarded-For', vpnIP)
        .send({
          raterId: user.email,
          rateeId: 'vpn-target',
          stars: 5,
          context: 'services'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      // Should detect VPN usage if IP is in known ranges
      expect(response.body.data.riskFactors).to.include('suspicious_ip');
    });

    it('should detect multiple device usage', async () => {
      const user = testUsers[0];
      
      // Simulate requests from different devices
      const devices = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
      ];

      for (const userAgent of devices) {
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${user.token}`)
          .set('User-Agent', userAgent)
          .send({
            raterId: user.email,
            rateeId: `device-${userAgent.length}`,
            stars: 4,
            context: 'general'
          })
          .expect(201);
      }

      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data.riskFactors).to.include('multiple_devices');
    });
  });

  describe('Bot Detection', () => {
    it('should detect headless browser usage', async () => {
      const headlessUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36';
      
      const response = await request(app)
        .post('/api/v1/ratings/submit')
        .set('User-Agent', headlessUserAgent)
        .send({
          raterId: 'bot@example.com',
          rateeId: 'bot-target',
          stars: 5,
          context: 'marketplace'
        });

      // Should be rejected or flagged
      expect(response.status).to.be.oneOf([401, 403, 201]);
      
      if (response.status === 201) {
        // Check if flagged as bot
        const riskResponse = await request(app)
          .get('/api/v1/security/ip-risk')
          .set('X-Forwarded-For', '192.168.1.100')
          .expect(200);

        expect(riskResponse.body.data.riskFactors).to.include('headless_browser');
      }
    });

    it('should detect bot-like user agents', async () => {
      const botUserAgents = [
        'curl/7.68.0',
        'Wget/1.20.3',
        'Python-requests/2.25.1',
        'PostmanRuntime/7.26.8'
      ];

      for (const userAgent of botUserAgents) {
        const response = await request(app)
          .get('/api/v1/ratings/user123')
          .set('User-Agent', userAgent)
          .expect(200);

        // Should still work for GET requests but be monitored
        expect(response.body.data).to.exist;
      }
    });

    it('should detect automated request patterns', async () => {
      const user = testUsers[1];
      
      // Make requests at perfectly regular intervals (bot-like)
      const interval = 1000; // 1 second
      const requestCount = 10;
      
      for (let i = 0; i < requestCount; i++) {
        await new Promise(resolve => setTimeout(resolve, interval));
        
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            raterId: user.email,
            rateeId: `automated${i}`,
            stars: 4,
            context: 'services'
          })
          .expect(201);
      }

      const response = await request(app)
        .get('/api/v1/security/user-risk')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body.data.riskScore).to.be.greaterThan(60);
    });
  });

  describe('Fraud Prevention Actions', () => {
    it('should automatically block high-risk users', async () => {
      // Create user and trigger multiple fraud indicators
      const riskyUser = {
        email: `risky${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        role: 'user'
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(riskyUser)
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: riskyUser.email,
          password: riskyUser.password
        })
        .expect(200);

      const token = loginResponse.body.data.tokens.accessToken;

      // Trigger multiple fraud indicators
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${token}`)
          .send({
            raterId: riskyUser.email,
            rateeId: `risk${i}`,
            stars: 5, // Perfect scores
            context: 'marketplace'
          })
          .expect(201);
      }

      // Check if user is blocked
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.error).to.include('blocked');
    });

    it('should require additional verification for suspicious activity', async () => {
      const user = testUsers[2];
      
      // Trigger suspicious activity
      for (let i = 0; i < 8; i++) {
        await request(app)
          .post('/api/v1/ratings/submit')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            raterId: user.email,
            rateeId: `verify${i}`,
            stars: 5,
            context: 'services'
          })
          .expect(201);
      }

      // Next action should require verification
      const response = await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          raterId: user.email,
          rateeId: 'verification-required',
          stars: 4,
          context: 'marketplace'
        })
        .expect(403);

      expect(response.body.error).to.include('verification');
    });

    it('should generate fraud alerts for security team', async () => {
      const user = testUsers[3];
      
      // Trigger critical fraud indicator
      await request(app)
        .post('/api/v1/ratings/submit')
        .set('Authorization', `Bearer ${user.token}`)
        .set('X-Forwarded-For', '192.168.100.1') // Suspicious IP
        .send({
          raterId: user.email,
          rateeId: 'alert-trigger',
          stars: 5,
          context: 'marketplace'
        })
        .expect(201);

      // Check if alert was generated
      const response = await request(app)
        .get('/api/v1/security/alerts')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.greaterThan(0);
      
      const latestAlert = response.body.data[0];
      expect(latestAlert.severity).to.equal('high');
      expect(latestAlert.type).to.include('fraud');
    });
  });

  describe('Fraud Reporting and Analytics', () => {
    it('should generate comprehensive fraud reports', async () => {
      const response = await request(app)
        .get('/api/v1/security/fraud-report')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .query({ timeRange: '24h' })
        .expect(200);

      const report = response.body.data;
      
      expect(report.summary).to.exist;
      expect(report.summary.totalFlaggedUsers).to.be.a('number');
      expect(report.summary.highRiskUsers).to.be.a('number');
      expect(report.summary.moderateRiskUsers).to.be.a('number');
      
      expect(report.patterns).to.exist;
      expect(report.patterns.perfect_scores).to.exist;
      expect(report.patterns.rapid_ratings).to.exist;
      expect(report.patterns.reciprocal_ratings).to.exist;
      
      expect(report.recommendations).to.be.an('array');
    });

    it('should provide fraud analytics', async () => {
      const response = await request(app)
        .get('/api/v1/security/fraud-analytics')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      const analytics = response.body.data;
      
      expect(analytics.timeSeries).to.exist;
      expect(analytics.riskDistribution).to.exist;
      expect(analytics.topRiskFactors).to.exist;
      expect(analytics.trendAnalysis).to.exist;
    });

    it('should export fraud data for analysis', async () => {
      const response = await request(app)
        .get('/api/v1/security/fraud-export')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .query({ format: 'csv', timeRange: '7d' })
        .expect(200);

      expect(response.headers['content-type']).to.include('text/csv');
      expect(response.text).to.include('userId,riskScore,suspiciousPatterns');
    });
  });

  after(async () => {
    // Cleanup test data
    for (const user of testUsers) {
      await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${user.token}`);
    }
  });
});
