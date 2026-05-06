import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

// Test configuration
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

export function setup() {
  // Setup test data if needed
  console.log('Setting up performance test...');
}

export default function () {
  // Test authentication endpoint
  const authResponse = http.post(`${BASE_URL}/api/v1/auth/login`, {
    email: 'test@example.com',
    password: 'password123'
  }, {
    headers: {
      'Content-Type': 'application/json',
    }
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
    raterId: `user${Math.floor(Math.random() * 1000)}`,
    rateeId: `user${Math.floor(Math.random() * 1000)}`,
    stars: Math.floor(Math.random() * 5) + 1,
    context: 'marketplace',
    contextId: `tx${Math.floor(Math.random() * 10000)}`
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
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
      'Authorization': `Bearer ${token}`,
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

  // Test user ratings retrieval
  const ratingsResponse = http.get(`${BASE_URL}/api/v1/ratings/user/user123?page=1&limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });

  const ratingsSuccess = check(ratingsResponse, {
    'ratings status is 200': (r) => r.status === 200,
    'ratings response time < 200ms': (r) => r.timings.duration < 200,
    'ratings has data': (r) => Array.isArray(r.json('data.reviews')),
  });

  if (!ratingsSuccess) {
    errorRate.add(1);
  }

  // Test leaderboard endpoint
  const leaderboardResponse = http.get(`${BASE_URL}/api/v1/trust/leaderboard?limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });

  const leaderboardSuccess = check(leaderboardResponse, {
    'leaderboard status is 200': (r) => r.status === 200,
    'leaderboard response time < 300ms': (r) => r.timings.duration < 300,
    'leaderboard has users': (r) => Array.isArray(r.json('data.users')),
  });

  if (!leaderboardSuccess) {
    errorRate.add(1);
  }

  sleep(1);
}

export function teardown() {
  // Cleanup test data if needed
  console.log('Performance test completed');
}
