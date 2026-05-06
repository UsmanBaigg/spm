# Trust & Rating Module - API Reference

**Version:** 1.0.0  
**Last Updated:** March 20, 2026  
**Base URL:** `http://localhost:3001/api/v1`

---

## Table of Contents

1. [Ratings API](#ratings-api)
2. [Reviews API](#reviews-api)
3. [Trust Score API](#trust-score-api)
4. [Data Models](#data-models)
5. [Error Codes](#error-codes)

---

## Ratings API

### 1. Submit Rating

**Endpoint:** `POST /ratings/submit`

**Purpose:** Submit a rating from one user to another

**Request Body:**
```json
{
  "raterId": "string (required)",
  "rateeId": "string (required)",
  "stars": "integer (required, 1-5)",
  "context": "string (optional, default: 'general')",
  "contextId": "string (optional)",
  "raterInfo": {
    "username": "string (optional)",
    "profileImage": "string (optional, URI)",
    "badge": "string (optional)"
  }
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Rating submitted successfully",
  "data": {
    "_id": "60e3b5f3c8d9e7a4b2c1f0e9",
    "raterId": "user123",
    "rateeId": "user456",
    "stars": 5,
    "context": "marketplace",
    "contextId": "txn789",
    "raterInfo": {
      "username": "john_doe",
      "profileImage": null,
      "badge": "trusted-neighbor"
    },
    "isAnonymous": false,
    "status": "active",
    "reportCount": 0,
    "isPinned": false,
    "createdAt": "2026-03-20T10:30:00.000Z",
    "updatedAt": "2026-03-20T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or invalid stars value
- `409 Conflict` - Duplicate rating already exists

---

### 2. Get Ratings for User

**Endpoint:** `GET /ratings/user/{userId}`

**Query Parameters:**
```
page: integer (optional, default: 1)
limit: integer (optional, default: 10, max: 100)
context: string (optional, values: 'marketplace', 'services', 'general')
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "ratings": [
      {
        "_id": "60e3b5f3c8d9e7a4b2c1f0e9",
        "raterId": "user123",
        "stars": 5,
        "context": "marketplace",
        "raterInfo": {
          "username": "john_doe",
          "badge": "trusted-neighbor"
        },
        "createdAt": "2026-03-20T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

---

### 3. Get Rating Statistics

**Endpoint:** `GET /ratings/stats/{userId}`

**Query Parameters:**
```
context: string (optional, values: 'marketplace', 'services', 'general')
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalRatings": 25,
    "averageRating": 4.64,
    "ratingDistribution": {
      "1": 0,
      "2": 0,
      "3": 1,
      "4": 8,
      "5": 16
    },
    "recentRatings": [
      {
        "_id": "60e3b5f3c8d9e7a4b2c1f0e9",
        "stars": 5,
        "createdAt": "2026-03-20T10:30:00Z"
      }
    ]
  }
}
```

---

### 4. Edit Rating

**Endpoint:** `PUT /ratings/{ratingId}`

**Request Body:**
```json
{
  "raterId": "string (required)",
  "newStars": "integer (required, 1-5)",
  "reviewText": "string (optional)"
}
```

**Constraints:**
- Can only edit within 24 hours of creation
- Only the rater can edit their own rating

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Rating updated successfully",
  "data": {
    "_id": "60e3b5f3c8d9e7a4b2c1f0e9",
    "raterId": "user123",
    "stars": 4,
    "status": "edited",
    "editHistory": [
      {
        "stars": 5,
        "editedAt": "2026-03-20T10:30:00Z"
      }
    ]
  }
}
```

**Error Responses:**
- `403 Forbidden` - Not the rating author
- `400 Bad Request` - Outside 24-hour edit window

---

### 5. Delete Rating

**Endpoint:** `DELETE /ratings/{ratingId}`

**Query Parameters:**
```
raterId: string (required)
```

**Constraints:**
- Can only delete within 24 hours of creation
- Only the rater can delete their own rating

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Rating deleted successfully",
  "data": {
    "success": true
  }
}
```

---

### 6. Report Rating

**Endpoint:** `POST /ratings/{ratingId}/report`

**Request Body:**
```json
{
  "reason": "string (required)"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Rating reported successfully",
  "data": {
    "_id": "60e3b5f3c8d9e7a4b2c1f0e9",
    "reportCount": 2,
    "status": "active"
  }
}
```

**Note:** After 3 reports, rating status automatically changes to "flagged"

---

### 7. Get Seller Ratings

**Endpoint:** `GET /ratings/seller/{userId}`

**Purpose:** Get marketplace-specific ratings for a seller

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalRatings": 12,
    "averageRating": 4.75,
    "ratingDistribution": { ... }
  }
}
```

---

### 8. Get Service Provider Ratings

**Endpoint:** `GET /ratings/service-provider/{userId}`

**Purpose:** Get services-specific ratings for a provider

**Success Response:** Same structure as seller ratings

---

## Reviews API

### 1. Create Review

**Endpoint:** `POST /reviews`

**Request Body:**
```json
{
  "ratingId": "string (required, MongoDB ObjectId)",
  "raterId": "string (required)",
  "content": "string (required, 10-500 chars)",
  "context": "string (optional, default: 'general')",
  "title": "string (optional, max 100 chars)",
  "tags": ["string (optional, see tag values below)"]
}
```

**Valid Tags:**
- `helpful` - Review is helpful
- `reliable` - User is reliable
- `friendly` - User is friendly
- `professional` - Professional service
- `poor-quality` - Poor quality work
- `unresponsive` - Unresponsive user
- `dishonest` - Dishonest behavior

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "_id": "60e3b5f3c8d9e7a4b2c1f0e9",
    "ratingId": "60e3b5f3c8d9e7a4b2c1f0e8",
    "raterId": "user123",
    "rateeId": "user456",
    "title": "Great seller!",
    "content": "Very responsive and delivered exactly as promised.",
    "context": "marketplace",
    "tags": ["reliable", "professional"],
    "status": "published",
    "helpfulCount": 0,
    "notHelpfulCount": 0,
    "createdAt": "2026-03-20T10:35:00Z"
  }
}
```

---

### 2. Edit Review

**Endpoint:** `PUT /reviews/{reviewId}`

**Request Body:**
```json
{
  "raterId": "string (required)",
  "content": "string (required, 10-500 chars)",
  "tags": ["string (optional)"]
}
```

**Constraints:** Can only edit within 24 hours

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": {
    "status": "edited",
    "editHistory": [
      {
        "content": "Original content...",
        "editedAt": "2026-03-20T10:35:00Z"
      }
    ]
  }
}
```

---

### 3. Delete Review

**Endpoint:** `DELETE /reviews/{reviewId}`

**Query Parameters:**
```
raterId: string (required)
```

**Constraints:** Can only delete within 24 hours

---

### 4. Get Reviews for User

**Endpoint:** `GET /reviews/user/{userId}`

**Query Parameters:**
```
page: integer (default: 1)
limit: integer (default: 10, max: 100)
context: string (optional)
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "_id": "60e3b5f3c8d9e7a4b2c1f0e9",
        "title": "Great seller!",
        "content": "Very responsive...",
        "tags": ["reliable", "professional"],
        "helpfulCount": 5,
        "notHelpfulCount": 1,
        "helpfulnessPercentage": 83,
        "createdAt": "2026-03-20T10:35:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 5. Mark Review as Helpful

**Endpoint:** `POST /reviews/{reviewId}/helpful`

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Review marked as helpful",
  "data": {
    "helpfulCount": 6
  }
}
```

---

### 6. Mark Review as Not Helpful

**Endpoint:** `POST /reviews/{reviewId}/not-helpful`

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Review marked as not helpful",
  "data": {
    "notHelpfulCount": 2
  }
}
```

---

### 7. Report Review

**Endpoint:** `POST /reviews/{reviewId}/report`

**Request Body:**
```json
{
  "reason": "string (required)"
}
```

**Valid Reasons:**
- `spam` - Spam content
- `offensive` - Offensive language
- `fake` - Fake review
- `harassment` - Harassment
- `inappropriate` - Inappropriate content

**Note:** After 3 reports, review is automatically flagged

---

### 8. Get Flagged Reviews (Admin)

**Endpoint:** `GET /reviews/admin/flagged`

**Query Parameters:**
```
page: integer (default: 1)
limit: integer (default: 10)
```

---

### 9. Approve Flagged Review (Admin)

**Endpoint:** `POST /reviews/{reviewId}/admin/approve`

**Success Response:** Review status changes to "published"

---

### 10. Remove Review (Admin)

**Endpoint:** `DELETE /reviews/{reviewId}/admin/remove`

**Request Body:**
```json
{
  "adminNotes": "string (optional)"
}
```

---

## Trust Score API

### 1. Initialize Trust Profile

**Endpoint:** `POST /trust/initialize`

**Request Body:**
```json
{
  "userId": "string (required)",
  "userEmail": "string (required)",
  "username": "string (required)"
}
```

**Purpose:** Called by Registration Module when user is created

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Trust profile initialized",
  "data": {
    "userId": "user123",
    "score": 50,
    "badge": "new-neighbor",
    "metrics": {
      "totalRatingsReceived": 0,
      "averageRating": 0,
      "accountAgeDays": 0,
      "verificationStatus": "unverified",
      "moderationIncidents": 0
    }
  }
}
```

---

### 2. Get Trust Profile

**Endpoint:** `GET /trust/{userId}`

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "score": 72,
    "badge": "trusted-neighbor",
    "metrics": {
      "totalRatingsReceived": 25,
      "averageRating": 4.64,
      "marketplaceRatings": {
        "count": 15,
        "average": 4.8
      },
      "serviceRatings": {
        "count": 10,
        "average": 4.4
      },
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

---

### 3. Recalculate Trust Score

**Endpoint:** `PUT /trust/{userId}/recalculate`

**Purpose:** Manually trigger score recalculation (normally automatic)

**Access:** Admin only

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Trust score recalculated",
  "data": { ... (trust profile) ... }
}
```

---

### 4. Apply Moderation Penalty

**Endpoint:** `POST /trust/{userId}/moderation-penalty`

**Request Body:**
```json
{
  "penaltyPoints": "number (required)",
  "reason": "string (required)"
}
```

**Access:** Admin/Moderation Module only

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Moderation penalty applied",
  "data": { ... (updated trust profile) ... }
}
```

---

### 5. Update Verification Status

**Endpoint:** `PUT /trust/{userId}/verification-status`

**Request Body:**
```json
{
  "status": "string (required)"
}
```

**Valid Status Values:**
- `unverified`
- `verified`
- `premium-verified`

**Access:** Admin only

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification status updated",
  "data": { ... (updated trust profile) ... }
}
```

---

### 6. Get Top Rated Users (Leaderboard)

**Endpoint:** `GET /trust/leaderboard/top-rated`

**Query Parameters:**
```
limit: integer (default: 10, max: 100)
context: string (optional, values: 'marketplace', 'services')
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "userId": "user123",
      "score": 98,
      "badge": "community-star",
      "metrics": {
        "totalRatingsReceived": 50,
        "averageRating": 4.95
      }
    }
  ]
}
```

---

### 7. Get Users by Badge

**Endpoint:** `GET /trust/badge/{badge}`

**Valid Badge Values:**
- `new-neighbor`
- `community-member`
- `trusted-neighbor`
- `verified-contributor`
- `community-star`
- `verified-seller`
- `trusted-service-provider`

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "badge": "trusted-neighbor",
    "count": 342,
    "users": [ ... ]
  }
}
```

---

### 8. Get Trust Score History

**Endpoint:** `GET /trust/{userId}/history`

**Query Parameters:**
```
limit: integer (default: 20, max: 100)
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "currentScore": 72,
    "currentBadge": "trusted-neighbor",
    "history": [
      {
        "score": 72,
        "badge": "trusted-neighbor",
        "reason": "rating-update",
        "changedAt": "2026-03-20T10:35:00Z"
      },
      {
        "score": 70,
        "badge": "trusted-neighbor",
        "reason": "rating-update",
        "changedAt": "2026-03-19T14:20:00Z"
      }
    ]
  }
}
```

---

## Data Models

### Rating Model
```javascript
{
  raterId: String,
  rateeId: String,
  stars: Number (1-5),
  context: String,
  contextId: String,
  raterInfo: {
    username: String,
    profileImage: String,
    badge: String
  },
  isAnonymous: Boolean,
  status: String,
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

### Review Model
```javascript
{
  ratingId: ObjectId,
  raterId: String,
  rateeId: String,
  title: String,
  content: String,
  context: String,
  tags: [String],
  status: String,
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

### TrustScore Model
```javascript
{
  userId: String,
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
  createdAt: Date,
  updatedAt: Date
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid input or missing required fields |
| 403 | Forbidden | Unauthorized action (e.g., editing another user's rating) |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate rating or resource already exists |
| 500 | Internal Server Error | Unexpected server error |

---

## Rate Limiting

(Recommended to implement)
- Requests per user per minute: 60
- Requests per IP per minute: 600
- Burst limit: 10 requests per second

---

## Changelog

### v1.0.0 (March 20, 2026)
- Initial API release
- Core rating and review endpoints
- Trust score calculation
- Badge system
- Admin functions

