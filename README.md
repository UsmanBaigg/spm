# Trust & Rating Module - Backend

A comprehensive REST API backend for the Trust & Rating Module of the Bring Verified Neighborhood Community Platform.

## 🎯 Overview

The Trust & Rating Module enables community members to:
- Rate and review each other (1-5 stars)
- Build and maintain trust scores (0-100)
- Earn trust badges based on reputation
- Track rating history and trends

## 🛠️ Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **API Format:** REST (JSON)
- **Authentication:** JWT (Integration with Registration Module)
- **Documentation:** Swagger/OpenAPI 3.0
- **Validation:** Joi
- **Security:** Helmet, CORS

## 📋 Prerequisites

- Node.js v16+ 
- MongoDB v4.4+
- npm or yarn

## 🚀 Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/trust-rating-module.git
cd Trust-Rating-Module
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```

Edit `.env` and configure:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/bring-trust-rating
JWT_SECRET=your_secret_key
```

4. **Start MongoDB**
```bash
mongod
```

5. **Run the server**
```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:3001`

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api/v1
```

### Interactive Documentation
Visit `http://localhost:3001/api-docs` for Swagger UI

---

## 🔷 Core Endpoints

### Ratings API

#### Submit Rating
```http
POST /ratings/submit
Content-Type: application/json

{
  "raterId": "user123",
  "rateeId": "user456",
  "stars": 5,
  "context": "marketplace",
  "contextId": "transaction789",
  "raterInfo": {
    "username": "john_doe",
    "profileImage": "https://...",
    "badge": "verified-contributor"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Rating submitted successfully",
  "data": {
    "_id": "rating_id",
    "raterId": "user123",
    "rateeId": "user456",
    "stars": 5,
    "context": "marketplace",
    "status": "active",
    "createdAt": "2026-03-20T10:30:00Z"
  }
}
```

#### Get Ratings for User
```http
GET /ratings/user/{userId}?page=1&limit=10&context=marketplace
```

#### Get Rating Statistics
```http
GET /ratings/stats/{userId}?context=marketplace
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRatings": 25,
    "averageRating": 4.6,
    "ratingDistribution": {
      "1": 0,
      "2": 1,
      "3": 2,
      "4": 6,
      "5": 16
    }
  }
}
```

#### Edit Rating (within 24 hours)
```http
PUT /ratings/{ratingId}
Content-Type: application/json

{
  "raterId": "user123",
  "newStars": 4
}
```

#### Delete Rating (within 24 hours)
```http
DELETE /ratings/{ratingId}?raterId=user123
```

#### Report Rating
```http
POST /ratings/{ratingId}/report
Content-Type: application/json

{
  "reason": "spam"
}
```

---

### Reviews API

#### Create Review
```http
POST /reviews
Content-Type: application/json

{
  "ratingId": "rating_id",
  "raterId": "user123",
  "content": "Great experience! Very responsive and professional.",
  "context": "marketplace",
  "title": "Excellent Service",
  "tags": ["helpful", "professional"]
}
```

#### Edit Review (within 24 hours)
```http
PUT /reviews/{reviewId}
Content-Type: application/json

{
  "raterId": "user123",
  "content": "Updated review content..."
}
```

#### Delete Review (within 24 hours)
```http
DELETE /reviews/{reviewId}?raterId=user123
```

#### Get Reviews for User
```http
GET /reviews/user/{userId}?page=1&limit=10&context=marketplace
```

#### Mark Review as Helpful
```http
POST /reviews/{reviewId}/helpful
```

#### Report Review
```http
POST /reviews/{reviewId}/report
Content-Type: application/json

{
  "reason": "offensive"
}
```

---

### Trust Score API

#### Initialize Trust Profile
```http
POST /trust/initialize
Content-Type: application/json

{
  "userId": "user123",
  "userEmail": "user@example.com",
  "username": "john_doe"
}
```

#### Get Trust Profile
```http
GET /trust/{userId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 72,
    "badge": "trusted-neighbor",
    "metrics": {
      "totalRatingsReceived": 25,
      "averageRating": 4.6,
      "accountAgeDays": 120,
      "verificationStatus": "verified",
      "moderationIncidents": 0
    },
    "qualifications": {
      "isSellerVerified": true,
      "isServiceProviderVerified": false
    }
  }
}
```

#### Recalculate Trust Score
```http
PUT /trust/{userId}/recalculate
```

#### Get Trust History
```http
GET /trust/{userId}/history?limit=20
```

#### Get Top Rated Users
```http
GET /trust/leaderboard/top-rated?limit=10&context=marketplace
```

#### Get Users by Badge
```http
GET /trust/badge/{badge}
```

#### Apply Moderation Penalty (Admin)
```http
POST /trust/{userId}/moderation-penalty
Content-Type: application/json

{
  "penaltyPoints": 5,
  "reason": "violation-of-community-guidelines"
}
```

#### Update Verification Status (Admin)
```http
PUT /trust/{userId}/verification-status
Content-Type: application/json

{
  "status": "verified"
}
```

---

## 🎖️ Badge System

Badges are automatically assigned based on trust scores:

| Badge | Score Range | Requirements |
|-------|-------------|--------------|
| New Neighbor | 0-30 | New user, no ratings |
| Community Member | 31-59 | Some community participation |
| Trusted Neighbor | 60-79 | Good standing, 5+ ratings |
| Verified Contributor | 80-94 | High reputation |
| Community Star | 95-100 | Excellent reputation |
| Verified Seller | Extra | 10+ marketplace ratings, avg ≥ 4.0 |
| Trusted Service Provider | Extra | 5+ service ratings, avg ≥ 4.2 |

---

## 📊 Trust Score Calculation

### Formula
```
Trust Score = (
  (avgRating / 5) * 40                // 40% from rating quality
  + min(ratingCount / 50, 1) * 20     // 20% from rating volume
  + (accountAge / 365) * 10           // 10% from account age
  + verificationBonus * 15             // 15% from verification
  + moderationPenalty * (-25)          // up to -25% for violations
) * 100
```

All values are clamped to [0, 100]

---

## 🗄️ Database Schema

### User Collection
```javascript
{
  userId: String,
  email: String,
  username: String,
  isVerified: Boolean,
  verificationDate: Date,
  accountAge: Number,
  isSuspended: Boolean,
  createdAt: Date
}
```

### Rating Collection
```javascript
{
  raterId: String,
  rateeId: String,
  stars: Number (1-5),
  context: String (marketplace|services|general),
  contextId: String,
  raterInfo: Object,
  status: String (active|edited|flagged|deleted),
  reportCount: Number,
  editHistory: Array,
  createdAt: Date
}
```

### Review Collection
```javascript
{
  ratingId: ObjectId,
  raterId: String,
  rateeId: String,
  content: String,
  context: String,
  tags: Array,
  status: String (published|edited|flagged|removed),
  helpfulCount: Number,
  notHelpfulCount: Number,
  flagReasons: Array,
  editHistory: Array,
  createdAt: Date
}
```

### TrustScore Collection
```javascript
{
  userId: String,
  score: Number (0-100),
  badge: String,
  metrics: Object,
  weightedFactors: Object,
  badges: Object,
  scoreHistory: Array,
  lastUpdated: Date,
  createdAt: Date
}
```

---

## ✅ Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "details": [
    {
      "field": "stars",
      "message": "must be between 1 and 5"
    }
  ]
}
```

### Common Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict (duplicate rating)
- `500` - Internal Server Error

---

## 🧪 Testing

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

---

## 📝 API Authentication

All endpoints support optional JWT authentication. Include in header:
```http
Authorization: Bearer {token}
```

Token should be obtained from the Registration module.

---

## 🔐 Security Features

- ✅ Helmet.js for HTTP headers
- ✅ CORS enabled with configurable origins
- ✅ Input validation with Joi
- ✅ MongoDB injection prevention
- ✅ Rate limiting (recommended to add)
- ✅ Request size limits
- ✅ Async error handling

---

## 🔗 Integration Points

### With Registration Module
- Subscribe to user verification events
- Initialize trust profile on successful registration
- Update verification status

### With Moderation Module
- Receive moderation actions
- Apply trust score penalties
- Flag reviews for moderation

### With Marketplace Module
- Provide seller ratings
- Return trust scores for listings

### With Services Directory
- Provide service provider ratings
- Return availability badges

---

## 📱 Request/Response Examples

### Example 1: Submit Rating with Review
```bash
curl -X POST http://localhost:3001/api/v1/ratings/submit \
  -H "Content-Type: application/json" \
  -d '{
    "raterId": "user123",
    "rateeId": "user456",
    "stars": 5,
    "context": "marketplace"
  }'
```

### Example 2: Get User Trust Profile
```bash
curl http://localhost:3001/api/v1/trust/user456
```

### Example 3: Get Top Rated Users
```bash
curl "http://localhost:3001/api/v1/trust/leaderboard/top-rated?limit=10&context=marketplace"
```

---

## 🚀 Deployment

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables (Production)
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bring-trust
JWT_SECRET=production_secret_key
CORS_ORIGIN=https://bring.com,https://www.bring.com
```

---

## 📖 Documentation Files

- `SP-SRS_Trust_Rating_Module.md` - Software Requirements Specification
- `SP-SDS_Trust_Rating_Module.md` - Software Design Specification
- `SPMP_Trust_Rating_Module.md` - Software Project Management Plan
- `Kickoff_Talking_Points_Trust_Rating.md` - Project kickoff details

---

## 📞 Support & Contact

**Project Lead:** Usman Baig  
**Team:** Matrix Group - Backend Development  
**Email:** trust-module@bring.com

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🔄 Version History

### v1.0.0 (March 20, 2026)
- Initial release
- Core rating and review APIs
- Trust score calculation
- Badge assignment system
- Admin functions

