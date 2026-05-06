# Trust & Rating Module - Architecture & Implementation Guide

**Project:** Bring – A Verified Neighborhood Community Platform  
**Module:** Trust & Rating Module  
**Version:** 1.0.0  
**Date:** March 20, 2026  
**Team:** Matrix Group - Backend Development  

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Breakdown](#component-breakdown)
3. [API Endpoints](#api-endpoints)
4. [Trust Score Algorithm](#trust-score-algorithm)
5. [Database Schema](#database-schema)
6. [Integration Points](#integration-points)
7. [Setup & Deployment](#setup--deployment)

---

## Architecture Overview

### Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                   API Layer                             │
│   Express.js Routes (REST Endpoints)                    │
├─────────────────────────────────────────────────────────┤
│                 Service Layer                           │
│  RatingService | ReviewService | TrustScoreService     │
├─────────────────────────────────────────────────────────┤
│              Data Access Layer                          │
│  Mongoose Models & Database Operations                 │
├─────────────────────────────────────────────────────────┤
│                   Database                              │
│         MongoDB (Collections)                           │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 16+ |
| Framework | Express.js | 4.18.2 |
| Database | MongoDB | 4.4+ |
| ODM | Mongoose | 7.0.0 |
| Validation | Joi | 17.9.2 |
| Security | Helmet, CORS | Latest |
| Documentation | Swagger UI | 5.0.0 |
| Testing | Jest | 29.5.0 |

---

## Component Breakdown

### 1. API Layer (`/routes`)

#### Ratings Router (`ratings.js`)
- `POST /submit` - Submit new rating
- `PUT /:ratingId` - Edit rating (24h window)
- `DELETE /:ratingId` - Delete rating (24h window)
- `GET /user/:userId` - Get received ratings (paginated)
- `GET /given/:userId` - Get given ratings
- `GET /stats/:userId` - Get rating statistics
- `POST /:ratingId/report` - Report rating
- `GET /seller/:userId` - Get seller ratings
- `GET /service-provider/:userId` - Get service ratings
- `POST /:ratingId/pin` - Pin rating (admin)
- `DELETE /:ratingId/pin` - Unpin rating (admin)

**Responsibilities:**
- Parse and validate HTTP requests
- Call appropriate service methods
- Format and return responses
- Handle errors

#### Reviews Router (`reviews.js`)
- `POST /` - Create review for rating
- `PUT /:reviewId` - Edit review (24h window)
- `DELETE /:reviewId` - Delete review (24h window)
- `GET /user/:userId` - Get received reviews
- `GET /written/:userId` - Get written reviews
- `POST /:reviewId/helpful` - Mark as helpful
- `POST /:reviewId/not-helpful` - Mark as not helpful
- `POST /:reviewId/report` - Report review
- `GET /helpful/:userId` - Get most helpful reviews
- `GET /admin/flagged` - Get flagged reviews
- `POST /:reviewId/admin/approve` - Approve review
- `DELETE /:reviewId/admin/remove` - Remove review

#### Trust Score Router (`trustScore.js`)
- `POST /initialize` - Initialize trust profile
- `GET /:userId` - Get trust profile
- `PUT /:userId/recalculate` - Recalculate score
- `POST /:userId/moderation-penalty` - Apply penalty
- `PUT /:userId/verification-status` - Update verification
- `GET /leaderboard/top-rated` - Get top users
- `GET /badge/:badge` - Get users by badge
- `GET /:userId/history` - Get score history

---

### 2. Service Layer (`/services`)

#### RatingService
```javascript
class RatingService {
  static async submitRating()              // Create rating
  static async editRating()                // Update rating
  static async deleteRating()              // Soft delete rating
  static async getRatingsForUser()         // Fetch user's ratings
  static async getRatingsGivenByUser()     // Fetch given ratings
  static async getRatingStats()            // Get aggregates
  static async reportRating()              // Flag rating
  static async getSellerRatings()          // Marketplace ratings
  static async getServiceProviderRatings() // Service ratings
  static async pinRating()                 // Admin pin
  static async unpinRating()               // Admin unpin
}
```

**Key Features:**
- Duplicate prevention
- 24-hour edit/delete window
- Automatic trust score recalculation
- Rating aggregation and statistics

#### ReviewService
```javascript
class ReviewService {
  static async createReview()           // Link review to rating
  static async editReview()             // Update review content
  static async deleteReview()           // Soft delete review
  static async getReviewsForUser()      // Fetch user's reviews
  static async getReviewsWrittenByUser() // Fetch written reviews
  static async markHelpful()            // Increment helpful count
  static async markNotHelpful()         // Increment not helpful
  static async reportReview()           // Flag review
  static async getMostHelpfulReviews()  // Top reviews
  static async getFlaggedReviews()      // Admin view
  static async approveFlaggedReview()   // Admin approve
  static async removeReviewAsAdmin()    // Admin remove
}
```

**Key Features:**
- Content moderation workflow
- Helpfulness tracking
- Edit history maintenance
- Admin moderation tools

#### TrustScoreService
```javascript
class TrustScoreService {
  static async initializeTrustProfile()        // New user setup
  static async recalculateTrustScore()         // Score engine
  static async getTrustProfile()               // Retrieve profile
  static async applyModerationPenalty()        // Admin action
  static async updateVerificationStatus()      // Verification update
  static async getTopRatedUsers()              // Leaderboard
  static async getUsersByBadge()               // Badge query
}
```

**Key Features:**
- Weighted score calculation
- Badge assignment logic
- Seller/provider qualification checks
- Score history tracking

---

### 3. Data Models (`/models`)

#### User Model
Stores basic user information for ratings context

```javascript
{
  userId: String (unique),
  email: String (unique),
  username: String,
  profileImage: String,
  isVerified: Boolean,
  verificationDate: Date,
  accountAge: Number,
  isSuspended: Boolean,
  createdAt: Date
}
```

#### Rating Model
Stores individual ratings between users

```javascript
{
  raterId: String (indexed),
  rateeId: String (indexed),
  stars: Number (1-5),
  context: String (marketplace|services|general),
  contextId: String,
  raterInfo: {
    username: String,
    profileImage: String,
    badge: String
  },
  isAnonymous: Boolean,
  status: String (active|edited|flagged|deleted),
  reportCount: Number,
  isPinned: Boolean,
  editHistory: [{
    stars: Number,
    editedAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(raterId, rateeId, context, contextId)` - Unique constraint for duplicate prevention
- `(rateeId, createdAt)` - For fetching ratings
- `(status)` - For filtering active ratings

#### Review Model
Stores textual reviews linked to ratings

```javascript
{
  ratingId: ObjectId (unique, references Rating),
  raterId: String (indexed),
  rateeId: String (indexed),
  title: String,
  content: String (10-500 chars),
  context: String,
  tags: [String],
  status: String (published|edited|flagged|removed),
  helpfulCount: Number,
  notHelpfulCount: Number,
  reportCount: Number,
  flagReasons: [{
    reason: String,
    count: Number,
    flaggedAt: Date
  }],
  editHistory: [{
    content: String,
    editedAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(rateeId, createdAt)` - For timeline queries
- `(status)` - For filtering published reviews
- `(ratingId)` - For rating lookup

#### TrustScore Model
Stores computed trust information for each user

```javascript
{
  userId: String (unique, indexed),
  score: Number (0-100),
  badge: String,
  metrics: {
    totalRatingsReceived: Number,
    averageRating: Number,
    marketplaceRatings: {
      count: Number,
      average: Number
    },
    serviceRatings: {
      count: Number,
      average: Number
    },
    accountAgeDays: Number,
    verificationStatus: String,
    moderationIncidents: Number
  },
  weightedFactors: {
    ratingWeight: Number,
    volumeWeight: Number,
    accountAgeWeight: Number,
    verificationBonus: Number,
    moderationPenalty: Number
  },
  badges: {
    verifiedSeller: {
      earned: Boolean,
      earnedDate: Date
    },
    trustedServiceProvider: {
      earned: Boolean,
      earnedDate: Date
    }
  },
  scoreHistory: [{
    score: Number,
    badge: String,
    reason: String,
    changedAt: Date
  }],
  lastUpdated: Date,
  createdAt: Date
}
```

**Indexes:**
- `(score)` - For leaderboard queries
- `(badge)` - For badge-based filtering
- `(lastUpdated)` - For recalculation scheduling

---

### 4. Middleware (`/middleware`)

#### Validation Middleware (`validation.js`)
Uses Joi for schema validation

```javascript
export const validateRequest(schemaName)  // Body validation
export const validateParams(schemaName)   // URL param validation
export const validateQuery(schemaName)    // Query param validation
```

**Validation Schemas:**
- `submitRating` - Validates rating submission
- `editRating` - Validates rating edit
- `createReview` - Validates review creation
- `editReview` - Validates review edit
- `reportReview` - Validates report submission

#### Error Handler Middleware (`errorHandler.js`)
Centralized error handling

```javascript
export const errorHandler()     // Global error handler
export const notFoundHandler()  // 404 handler
export const asyncHandler()     // Async error wrapper
```

**Features:**
- Mongoose error handling
- Custom error formatting
- Validation error reporting
- Status code assignment

---

## API Endpoints

### Rating Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/ratings/submit` | Submit rating | Optional |
| PUT | `/ratings/:id` | Edit rating | Optional |
| DELETE | `/ratings/:id` | Delete rating | Optional |
| GET | `/ratings/user/:id` | Get received ratings | - |
| GET | `/ratings/given/:id` | Get given ratings | - |
| GET | `/ratings/stats/:id` | Get statistics | - |
| POST | `/ratings/:id/report` | Report rating | Optional |
| GET | `/ratings/seller/:id` | Get seller ratings | - |
| GET | `/ratings/service-provider/:id` | Get service ratings | - |

### Review Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/reviews` | Create review | Optional |
| PUT | `/reviews/:id` | Edit review | Optional |
| DELETE | `/reviews/:id` | Delete review | Optional |
| GET | `/reviews/user/:id` | Get received reviews | - |
| GET | `/reviews/written/:id` | Get written reviews | - |
| POST | `/reviews/:id/helpful` | Mark helpful | Optional |
| POST | `/reviews/:id/not-helpful` | Mark not helpful | Optional |
| POST | `/reviews/:id/report` | Report review | Optional |
| GET | `/reviews/admin/flagged` | Get flagged (admin) | Admin |

### Trust Score Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/trust/initialize` | Initialize profile | - |
| GET | `/trust/:id` | Get trust profile | - |
| PUT | `/trust/:id/recalculate` | Recalculate (admin) | Admin |
| POST | `/trust/:id/moderation-penalty` | Apply penalty (admin) | Admin |
| PUT | `/trust/:id/verification-status` | Update status (admin) | Admin |
| GET | `/trust/leaderboard/top-rated` | Get top users | - |
| GET | `/trust/badge/:badge` | Get by badge | - |
| GET | `/trust/:id/history` | Get history | - |

---

## Trust Score Algorithm

### Formula

```
Score = (
  (avgRating / 5) * 40            +    // 40% Rating Quality
  min(count / 50, 1) * 20         +    // 20% Rating Volume
  (accountAge / 365) * 10         +    // 10% Account Age
  verificationBonus * 15          +    // 15% Verification
  moderationPenalty * (-25)            // -25% Moderation
) * 100
```

**Clamped to [0, 100]**

### Components

#### 1. Rating Quality (40%)
- Based on average star rating received
- Formula: `(averageStars / 5) * 40`
- Max contribution: 40 points

#### 2. Rating Volume (20%)
- Based on number of ratings received
- Formula: `min(ratingCount / 50, 1) * 20`
- Caps at 50 ratings minimum for max contribution
- Max contribution: 20 points

#### 3. Account Age (10%)
- Based on days since registration
- Formula: `(accountAgeDays / 365) * 10`
- Caps at 365 days for max contribution
- Max contribution: 10 points

#### 4. Verification Bonus (15%)
- Applied if user is verified (address verified)
- Full 15% bonus or 0%
- Max contribution: 15 points

#### 5. Moderation Penalty (-25%)
- Applied for rule violations
- Each incident: -5%
- Max penalty: -25% (5 incidents)
- Min score: 0 (never goes negative)

### Example Calculation

**User Profile:**
- Average Rating: 4.6 stars
- Ratings Received: 25
- Account Age: 120 days
- Verified: Yes
- Moderation Incidents: 0

**Calculation:**
```
Rating Quality:     (4.6 / 5) * 40      = 36.8
Rating Volume:      min(25 / 50, 1) * 20 = 10
Account Age:        (120 / 365) * 10    = 3.28
Verification Bonus: 15 * 1              = 15
Moderation Penalty: 0

Total: 36.8 + 10 + 3.28 + 15 + 0 = 65.08 → 65 (rounded)

Badge: "trusted-neighbor" (60-79 range)
```

---

## Database Schema

### Collections

#### ratings
- Purpose: Store individual ratings
- Document size: ~500 bytes
- Estimated size: 500K docs × 500B = 250MB
- TTL: None (permanent)

#### reviews
- Purpose: Store review text
- Document size: ~1-2KB
- Estimated size: 200K docs × 1.5KB = 300MB
- TTL: None (permanent)

#### trust_scores
- Purpose: Store computed trust information
- Document size: ~2KB
- Estimated size: 50K docs × 2KB = 100MB
- TTL: None (updated regularly)

#### users
- Purpose: Store user info for ratings context
- Document size: ~300 bytes
- Estimated size: 50K docs × 300B = 15MB
- TTL: None (synced with Registration Module)

### Total Estimated Database Size
~665 MB for 1M+ ratings

### Backup Strategy
- Daily incremental backups
- Weekly full backups
- 30-day retention policy

---

## Integration Points

### 1. With Registration Module

**Events Consumed:**
```javascript
// New User Created
{
  event: 'user.registered',
  userId: 'uuid',
  email: 'user@example.com',
  username: 'john_doe'
}

// User Verified
{
  event: 'user.verified',
  userId: 'uuid',
  verificationDate: '2026-03-20T10:30:00Z'
}
```

**Actions:**
- Initialize trust profile with score = 50
- Update verification status
- Recalculate trust score

### 2. With Moderation Module

**Events Consumed:**
```javascript
// Moderation Action
{
  event: 'moderation.action',
  userId: 'uuid',
  action: 'warning|suspension|ban',
  reason: 'harassment',
  severity: 'low|medium|high'
}
```

**Actions:**
- Apply trust score penalty
- Flag reviews/ratings for review
- Record incident in audit log

### 3. With Marketplace Module

**APIs Provided:**
```javascript
GET /ratings/seller/{userId}
// Response: { count, average, distribution }

GET /trust/{userId}
// Response: { score, badge, verifiedSeller }
```

**Use Cases:**
- Display seller rating on listings
- Show trust badge on profile
- Filter by rating in search

### 4. With Services Directory Module

**APIs Provided:**
```javascript
GET /ratings/service-provider/{userId}
// Response: { count, average, distribution }

GET /trust/{userId}
// Response: { score, badge, trustedServiceProvider }
```

**Use Cases:**
- Display provider rating
- Filter by service rating
- Show badges on directory

### 5. With Feed Module

**APIs Provided:**
```javascript
GET /trust/{userId}
// Response: { score, badge }
```

**Use Cases:**
- Boost post ranking by trust score
- Show trust badge on posts
- Filter feed by user trust

### 6. With Admin Panel

**APIs Provided:**
```javascript
GET /trust/{userId}/history
PUT /trust/{userId}/verification-status
POST /trust/{userId}/moderation-penalty
GET /reviews/admin/flagged
DELETE /reviews/{reviewId}/admin/remove
POST /ratings/{ratingId}/pin
```

**Use Cases:**
- View full trust history
- Manage user verification
- Review moderation queue
- Pin/unpin reviews

---

## Setup & Deployment

### Local Development

**1. Clone Repository**
```bash
cd c:\Users\Use\Desktop\spm
git clone <repo-url> Trust-Rating-Module
cd Trust-Rating-Module
```

**2. Install Dependencies**
```bash
npm install
```

**3. Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

**4. Start MongoDB**
```bash
mongod --dbpath ./data
```

**5. Run Development Server**
```bash
npm run dev
```

**6. Access API**
- API: http://localhost:3001/api/v1
- Docs: http://localhost:3001/api-docs
- Health: http://localhost:3001/health

### Testing

**Run Tests**
```bash
npm test
```

**Watch Mode**
```bash
npm run test:watch
```

**Coverage**
```bash
npm test -- --coverage
```

### Docker Deployment

**Build Image**
```bash
docker build -t trust-rating-module:latest .
```

**Run Container**
```bash
docker run -p 3001:3001 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017 \
  trust-rating-module:latest
```

### Production Deployment

**Environment Variables**
```bash
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bring-trust
JWT_SECRET=<strong-secret>
CORS_ORIGIN=https://bring.com,https://api.bring.com
```

**Health Checks**
```bash
curl http://localhost:3001/health
```

**Monitoring**
- Monitor database query performance
- Track API response times
- Monitor error rates
- Alert on trust score anomalies

---

## Development Workflow

### Adding New Feature

1. **Create Service Method**
   - Add logic to appropriate service
   - Handle errors properly
   - Log significant actions

2. **Create API Endpoint**
   - Add route in router
   - Add validation rules
   - Document endpoint in swagger

3. **Write Tests**
   - Unit tests for service
   - Integration tests for endpoint
   - Edge case tests

4. **Update Documentation**
   - Update API_REFERENCE.md
   - Add Swagger comments
   - Update README if needed

5. **Commit & Push**
   ```bash
   git checkout -b feature/new-feature
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

---

## Performance Optimization

### Database Optimization
- Compound indexes for common queries
- MongoDB aggregation pipeline for stats
- Cache trust scores (update every hour)
- Archive old audit logs (>1 year)

### Application Optimization
- Response caching for public endpoints
- Batch score recalculation (off-peak)
- Limit pagination max to 100
- Compress responses with gzip

### Scaling Strategies
- Database replication
- Read replicas for analytics
- Message queue for async tasks
- CDN for API documentation

---

## Summary

The Trust & Rating Module is a comprehensive system for managing user reputation in the Bring platform. With a well-designed architecture, clear separation of concerns, and robust error handling, it provides the foundation for trust-based features across the platform.

**Key Achievements:**
✅ Complete REST API with 25+ endpoints
✅ Sophisticated trust score algorithm
✅ Comprehensive badge system
✅ Admin moderation tools
✅ API documentation (Swagger)
✅ MongoDB database schema
✅ Middleware & validation
✅ Error handling
✅ Production-ready code

