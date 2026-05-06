# 🚀 Implementation Guide for Members 3 & 4

**Project:** Trust & Rating Module - Bring Platform  
**Team:** Matrix Group  
**Last Updated:** May 6, 2026

---

## 📋 Overview

This guide provides step-by-step implementation instructions for Member 3 (Security & Authentication) and Member 4 (DevOps & Testing) to complete the remaining 60% of their work and bring the entire project to 100% completion.

---

## 🎯 Current Project Status

### **✅ Completed Work:**
- **Member 1 (Backend)**: 100% ✅ - Complete API, services, database
- **Member 2 (Frontend)**: 100% ✅ - Complete React app, UI/UX, integration
- **Foundation**: 95% ✅ - Core infrastructure, basic security, testing framework

### **🟡 Remaining Work:**
- **Member 3 (Security)**: 30% remaining - Advanced auth, fraud detection, monitoring
- **Member 4 (DevOps)**: 60% remaining - CI/CD, deployment, advanced testing, monitoring

---

## 🔧 Member 3 Implementation Guide

### **Phase 1: Authentication System (Week 1)**

#### **Step 1.1: Setup Authentication Infrastructure**
```bash
# Install required packages
npm install passport passport-jwt passport-local
npm install express-session connect-redis
npm install redis device express-device

# Create authentication directory
mkdir -p middleware/auth
mkdir -p services/auth
mkdir - routes/auth
```

#### **Step 1.2: Implement JWT Token Management**
```javascript
// Create: middleware/auth/jwt.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export class JWTManager {
  static generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '15m',
      issuer: 'bring-trust-rating',
      audience: 'bring-users'
    });

    const refreshToken = jwt.sign(
      { id: user.id }, 
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  static async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }
}
```

#### **Step 1.3: Create Authentication Middleware**
```javascript
// Create: middleware/auth/authenticate.js
import { JWTManager } from './jwt.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = JWTManager.verifyAccessToken(token);
    
    // Add user info to request
    req.user = decoded;
    req.tokenIssuedAt = decoded.iat;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
    
    return res.status(500).json({ 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};
```

#### **Step 1.4: Create Authentication Routes**
```javascript
// Create: routes/auth.js
import express from 'express';
import { body, validationResult } from 'express-validator';
import { JWTManager } from '../middleware/auth/jwt.js';
import { authenticate } from '../middleware/auth/authenticate.js';

const router = express.Router();

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;
    
    // Find user (implement User model if not exists)
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isValidPassword = await JWTManager.comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = JWTManager.generateTokens(user);

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.save();

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          profileImage: user.profileImage
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900 // 15 minutes
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

// Register endpoint
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('username').isLength({ min: 3, max: 30 }).isAlphanumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, username } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const hashedPassword = await JWTManager.hashPassword(password);

    // Create user
    const user = new User({
      email,
      username,
      password: hashedPassword,
      role: 'user',
      isVerified: false,
      createdAt: new Date()
    });

    await user.save();

    // Initialize trust profile
    const TrustScoreService = require('../services/TrustScoreService.js');
    await TrustScoreService.initializeTrustProfile(
      user.id, 
      user.email, 
      user.username
    );

    // Generate tokens
    const { accessToken, refreshToken } = JWTManager.generateTokens(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = JWTManager.generateTokens(user);

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: 900
        }
      }
    });
  } catch (error) {
    res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// Logout endpoint
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Add token to blacklist (implement Redis blacklist)
    await TokenBlacklistService.addToBlacklist(req.token);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

export default router;
```

#### **Step 1.5: Update Server to Use Auth**
```javascript
// Update: server.js
import authRouter from './routes/auth.js';

// Add auth routes
app.use(`${apiPrefix}/auth`, authRouter);

// Apply authentication to protected routes
app.use(`${apiPrefix}/ratings/submit`, authenticate);
app.use(`${apiPrefix}/reviews`, authenticate);
app.use(`${apiPrefix}/trust`, authenticate);
```

### **Phase 2: Advanced Security Features (Week 2)**

#### **Step 2.1: Implement Fraud Detection**
```javascript
// Create: services/SecurityService.js
export class SecurityService {
  static async detectSuspiciousPatterns(review) {
    const patterns = {
      repetitive: this.checkRepetitiveContent(review.content),
      spam: this.checkSpamCharacteristics(review.content),
      timing: this.checkTimingPatterns(review.raterId, review.createdAt),
      rating: this.checkRatingPatterns(review.raterId, review.rating)
    };

    const suspiciousScore = Object.values(patterns).reduce((sum, score) => sum + score, 0);
    
    return {
      suspiciousScore,
      isSuspicious: suspiciousScore > 3,
      patterns
    };
  }

  static checkRepetitiveContent(content) {
    // Check for repeated words/phrases
    const words = content.toLowerCase().split(' ');
    const wordFrequency = {};
    
    words.forEach(word => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });

    const maxFrequency = Math.max(...Object.values(wordFrequency));
    return maxFrequency > 3 ? 2 : 0;
  }

  static checkSpamCharacteristics(content) {
    const spamIndicators = [
      /\b(buy|sell|cheap|free|click|link|offer)\b/gi,
      /\d{3,}/g, // Multiple numbers
      /[!]{3,}/g,  // Multiple exclamation marks
      /[A-Z]{10,}/g // All caps
    ];

    let spamScore = 0;
    spamIndicators.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) spamScore += matches.length;
    });

    return spamScore > 5 ? 2 : spamScore > 2 ? 1 : 0;
  }

  static async checkTimingPatterns(raterId, createdAt) {
    // Check if user is rating too quickly
    const recentRatings = await Rating.find({
      raterId,
      createdAt: { $gte: new Date(Date.now() - 60000) } // Last 1 minute
    });

    return recentRatings.length > 3 ? 2 : recentRatings.length > 1 ? 1 : 0;
  }

  static async checkRatingPatterns(raterId, rating) {
    // Check for unusual rating patterns
    const userRatings = await Rating.find({ raterId }).sort({ createdAt: -1 }).limit(10);
    
    if (userRatings.length < 5) return 0;

    const recentRatings = userRatings.slice(0, 5).map(r => r.stars);
    const averageRating = recentRatings.reduce((sum, r) => sum + r, 0) / recentRatings.length;

    // Suspicious if all ratings are the same extreme value
    if (recentRatings.every(r => r === 1) || recentRatings.every(r => r === 5)) {
      return 2;
    }

    return 0;
  }
}
```

#### **Step 2.2: Advanced Rate Limiting**
```javascript
// Update: middleware/rateLimit.js
import Redis from 'redis';

const redis = Redis.createClient(process.env.REDIS_URL);

export class AdvancedRateLimit {
  static async checkUserReputation(userId) {
    const trustScore = await TrustScore.findOne({ userId });
    
    if (!trustScore) return { multiplier: 1, maxRequests: 100 };

    const score = trustScore.score;
    let multiplier = 1;
    let maxRequests = 100;

    if (score >= 80) {
      multiplier = 2; // High trust users get 2x limits
      maxRequests = 200;
    } else if (score >= 60) {
      multiplier = 1.5; // Good trust users get 1.5x limits
      maxRequests = 150;
    } else if (score < 30) {
      multiplier = 0.5; // Low trust users get 0.5x limits
      maxRequests = 50;
    }

    return { multiplier, maxRequests };
  }

  static createDynamicLimiter(baseOptions) {
    return rateLimit({
      windowMs: baseOptions.windowMs,
      max: async (req) => {
        if (req.user) {
          const { maxRequests } = await this.checkUserReputation(req.user.id);
          return maxRequests;
        }
        return baseOptions.max;
      },
      keyGenerator: (req) => {
        return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
      },
      handler: async (req, res) => {
        // Log rate limit violation
        await SecurityMonitor.logSecurityEvent({
          type: 'RATE_LIMIT_VIOLATION',
          userId: req.user?.id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method
        });

        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(baseOptions.windowMs / 1000)
        });
      }
    });
  }
}
```

---

## 🚀 Member 4 Implementation Guide

### **Phase 1: Database & Testing Infrastructure (Week 1)**

#### **Step 1.1: Setup Production Database**
```bash
# Create database configuration
mkdir -p config
mkdir -p scripts
mkdir -p tests/integration
mkdir -p tests/e2e
mkdir -p tests/performance
```

#### **Step 1.2: Implement Database Optimization**
```javascript
// Create: scripts/setupDatabase.js
import mongoose from 'mongoose';
import IndexManager from '../config/indexManager.js';

async function setupProductionDatabase() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Setup indexes
    await IndexManager.setupPerformanceIndexes();
    
    // Setup aggregation pipelines
    await IndexManager.setupAggregationPipelines();
    
    // Setup database users and permissions
    await setupDatabaseUsers();
    
    console.log('✅ Production database setup completed');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

async function setupDatabaseUsers() {
  // Create application user with limited permissions
  const admin = mongoose.connection.db;
  
  await admin.addUser('app_user', process.env.DB_PASSWORD, {
    roles: [
      { role: 'readWrite', db: 'bring-trust-rating' }
    ]
  });
  
  await admin.addUser('backup_user', process.env.BACKUP_PASSWORD, {
    roles: [
      { role: 'read', db: 'bring-trust-rating' }
    ]
  });
}

setupProductionDatabase();
```

#### **Step 1.3: Implement Comprehensive Testing**
```javascript
// Create: tests/setup.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export async function setupTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  // Setup test data
  await setupTestData();
}

export async function teardownTestDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
}

async function setupTestData() {
  // Create test users
  const User = mongoose.model('User');
  await User.create([
    {
      id: 'user1',
      email: 'user1@test.com',
      username: 'testuser1',
      role: 'user'
    },
    {
      id: 'user2', 
      email: 'user2@test.com',
      username: 'testuser2',
      role: 'user'
    }
  ]);
}
```

#### **Step 1.4: Create Integration Test Suite**
```javascript
// Create: tests/integration/complete-flow.test.js
import request from 'supertest';
import app from '../../server.js';
import { setupTestDatabase, teardownTestDatabase } from '../setup.js';

describe('Complete User Flow Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  test('Complete rating and review workflow', async () => {
    // 1. User authentication
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user1@test.com',
        password: 'password123'
      });

    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.data.tokens.accessToken;

    // 2. Submit rating
    const ratingResponse = await request(app)
      .post('/api/v1/ratings/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rateeId: 'user2',
        stars: 5,
        context: 'marketplace',
        contextId: 'tx123'
      });

    expect(ratingResponse.status).toBe(201);
    const ratingId = ratingResponse.body.data._id;

    // 3. Add review
    const reviewResponse = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ratingId,
        content: 'Excellent service! Very professional.',
        title: 'Great Experience',
        tags: ['professional', 'helpful']
      });

    expect(reviewResponse.status).toBe(201);

    // 4. Check trust score updated
    const trustResponse = await request(app)
      .get('/api/v1/trust/user2')
      .set('Authorization', `Bearer ${token}`);

    expect(trustResponse.status).toBe(200);
    expect(trustResponse.body.data.score).toBeGreaterThan(50);

    // 5. Verify rating appears in user's ratings
    const ratingsResponse = await request(app)
      .get('/api/v1/ratings/user/user2')
      .set('Authorization', `Bearer ${token}`);

    expect(ratingsResponse.status).toBe(200);
    expect(ratingsResponse.body.data.reviews).toHaveLength(1);
  });
});
```

### **Phase 2: CI/CD Pipeline (Week 2)**

#### **Step 2.1: Create GitHub Actions Workflow**
```yaml
# Create: .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master ]

env:
  NODE_VERSION: '18'
  MONGODB_VERSION: '5.0'

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:${{ env.MONGODB_VERSION }}
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.runCommand({ping: 1})'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run unit tests
      run: npm test
      env:
        TEST_MONGODB_URI: mongodb://localhost:27017/test
        NODE_ENV: test

    - name: Run integration tests
      run: npm run test:integration
      env:
        TEST_MONGODB_URI: mongodb://localhost:27017/test
        NODE_ENV: test

    - name: Run frontend tests
      run: |
        cd frontend
        npm ci
        npm test

    - name: Generate coverage report
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run security audit
      run: npm audit --audit-level moderate

    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build-and-deploy:
    needs: [lint-and-test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/master'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build application
      run: npm run build

    - name: Build Docker image
      run: |
        docker build -t trust-rating-backend:${{ github.sha }} .
        docker tag trust-rating-backend:${{ github.sha }} trust-rating-backend:latest

    - name: Deploy to staging
      run: |
        echo "Deploying to staging environment"
        # Add staging deployment commands here

    - name: Run smoke tests
      run: npm run test:smoke
      env:
        API_URL: https://staging-api.bring.com

    - name: Deploy to production
      if: success()
      run: |
        echo "Deploying to production environment"
        # Add production deployment commands here

    - name: Run production health check
      run: |
        curl -f https://api.bring.com/health || exit 1
```

#### **Step 2.2: Create Docker Configuration**
```dockerfile
# Update: Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm ci
RUN cd frontend && npm ci

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/models ./models
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/config ./config
COPY --from=builder /app/server.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3001

CMD ["node", "server.js"]
```

#### **Step 2.3: Create Production Deployment Script**
```bash
#!/bin/bash
# Create: scripts/deploy.sh

set -e

echo "🚀 Starting deployment process..."

# Environment variables
ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
REGISTRY=${DOCKER_REGISTRY:-your-registry.com}

echo "📦 Environment: $ENVIRONMENT"
echo "🏷️  Version: $VERSION"
echo "📋 Registry: $REGISTRY"

# Build and push Docker image
echo "🔨 Building Docker image..."
docker build -t $REGISTRY/trust-rating-backend:$VERSION .
docker push $REGISTRY/trust-rating-backend:$VERSION

# Deploy to Kubernetes
echo "☸️  Deploying to Kubernetes..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Wait for deployment
echo "⏳ Waiting for deployment to be ready..."
kubectl rollout status deployment/trust-rating-backend -n $ENVIRONMENT --timeout=300s

# Run health check
echo "🏥 Running health check..."
kubectl exec -n $ENVIRONMENT deployment/trust-rating-backend -- curl -f http://localhost:3001/health

echo "✅ Deployment completed successfully!"
```

### **Phase 3: Monitoring & Performance (Week 3)**

#### **Step 3.1: Implement Monitoring**
```javascript
// Create: monitoring/metrics.js
import prometheus from 'prom-client';
import { register } from 'prom-client';

class MetricsCollector {
  constructor() {
    this.setupMetrics();
  }

  setupMetrics() {
    // HTTP metrics
    this.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'user_role']
    });

    this.httpRequestTotal = new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_role']
    });

    // Database metrics
    this.dbQueryDuration = new prometheus.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['collection', 'operation', 'index_used']
    });

    this.dbConnectionsActive = new prometheus.Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections'
    });

    // Business metrics
    this.ratingsSubmitted = new prometheus.Counter({
      name: 'ratings_submitted_total',
      help: 'Total number of ratings submitted',
      labelNames: ['context', 'stars']
    });

    this.reviewsCreated = new prometheus.Counter({
      name: 'reviews_created_total',
      help: 'Total number of reviews created',
      labelNames: ['context']
    });

    this.trustScoreCalculations = new prometheus.Counter({
      name: 'trust_score_calculations_total',
      help: 'Total number of trust score calculations'
    });

    // Security metrics
    this.authenticationAttempts = new prometheus.Counter({
      name: 'authentication_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['result', 'method']
    });

    this.securityEvents = new prometheus.Counter({
      name: 'security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity']
    });
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        const userRole = req.user?.role || 'anonymous';
        
        this.httpRequestDuration
          .labels(req.method, route, res.statusCode, userRole)
          .observe(duration);
        
        this.httpRequestTotal
          .labels(req.method, route, res.statusCode, userRole)
          .inc();
      });
      
      next();
    };
  }

  recordRatingSubmitted(context, stars) {
    this.ratingsSubmitted.labels(context, stars.toString()).inc();
  }

  recordReviewCreated(context) {
    this.reviewsCreated.labels(context).inc();
  }

  recordTrustScoreCalculation() {
    this.trustScoreCalculations.inc();
  }

  recordAuthenticationAttempt(result, method) {
    this.authenticationAttempts.labels(result, method).inc();
  }

  recordSecurityEvent(eventType, severity) {
    this.securityEvents.labels(eventType, severity).inc();
  }

  async getMetrics() {
    return await register.metrics();
  }
}

export default new MetricsCollector();
```

#### **Step 3.2: Create Performance Tests**
```javascript
// Create: tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.1'],     // Error rate < 10%
    errors: ['rate<0.1'],              // Custom error rate < 10%
  },
};

const BASE_URL = 'http://localhost:3001';

export default function () {
  // Test authentication
  const authResponse = http.post(`${BASE_URL}/api/v1/auth/login`, {
    email: 'test@example.com',
    password: 'password123'
  });

  const authSuccess = check(authResponse, {
    'auth status is 200': (r) => r.status === 200,
    'auth response time < 500ms': (r) => r.timings.duration < 500,
    'auth has token': (r) => r.json('data.tokens.accessToken') !== undefined,
  });

  if (!authSuccess) {
    errorRate.add(1);
  }

  const token = authResponse.json('data.tokens.accessToken');

  // Test rating submission
  const ratingResponse = http.post(`${BASE_URL}/api/v1/ratings/submit`, {
    rateeId: `user${Math.floor(Math.random() * 1000)}`,
    stars: Math.floor(Math.random() * 5) + 1,
    context: 'marketplace',
    contextId: `tx${Math.floor(Math.random() * 10000)}`
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const ratingSuccess = check(ratingResponse, {
    'rating status is 201': (r) => r.status === 201,
    'rating response time < 300ms': (r) => r.timings.duration < 300,
  });

  if (!ratingSuccess) {
    errorRate.add(1);
  }

  // Test trust score retrieval
  const trustResponse = http.get(`${BASE_URL}/api/v1/trust/user123`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const trustSuccess = check(trustResponse, {
    'trust status is 200': (r) => r.status === 200,
    'trust response time < 200ms': (r) => r.timings.duration < 200,
    'trust has score': (r) => r.json('data.score') !== undefined,
  });

  if (!trustSuccess) {
    errorRate.add(1);
  }

  sleep(1);
}
```

---

## 📊 Implementation Checklist

### **Member 3 Security Checklist:**
- [ ] JWT token management system
- [ ] Authentication middleware
- [ ] Role-based access control
- [ ] User registration/login endpoints
- [ ] Fraud detection algorithms
- [ ] Advanced rate limiting
- [ ] Security monitoring system
- [ ] Security event logging
- [ ] Token blacklisting
- [ ] Device fingerprinting

### **Member 4 DevOps Checklist:**
- [ ] Production database setup
- [ ] Advanced indexing strategy
- [ ] Automated backup system
- [ ] Integration test suite
- [ ] End-to-end testing
- [ ] CI/CD pipeline
- [ ] Docker configuration
- [ ] Kubernetes deployment
- [ ] Monitoring system
- [ ] Performance testing
- [ ] Load testing
- [ ] Health checks
- [ ] Alert configuration

---

## 🎯 Success Criteria

### **Security Success Metrics:**
- **Authentication Success Rate**: >99%
- **False Positive Rate**: <5%
- **Security Response Time**: <100ms
- **Zero Critical Vulnerabilities**

### **DevOps Success Metrics:**
- **Deployment Frequency**: Multiple times per day
- **Lead Time**: <30 minutes
- **System Availability**: >99.9%
- **Test Coverage**: >80%

---

## 📞 Support & Escalation

### **Implementation Support:**
- **Technical Issues**: Create GitHub issue
- **Security Concerns**: Contact security team immediately
- **Deployment Issues**: Contact DevOps team
- **Emergency**: Project Lead (Usman Baig)

### **Documentation:**
- **API Documentation**: Available at `/api-docs`
- **Security Guidelines**: `MEMBER_3_SECURITY_WORK.md`
- **DevOps Guidelines**: `MEMBER_4_DEVOPS_WORK.md`
- **Architecture**: `ARCHITECTURE.md`

---

**🔄 Last Updated:** May 6, 2026  
**📋 Version:** 1.0.0  
**👥 Author:** Matrix Group - Implementation Team
