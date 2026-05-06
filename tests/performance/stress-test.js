import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let ratingCreationRate = new Rate('rating_creation_success');
export let trustScoreRate = new Rate('trust_score_success');

// Stress test configuration
export let options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 500 },   // Ramp up to 500 users
    { duration: '10m', target: 1000 }, // Ramp up to 1000 users
    { duration: '5m', target: 500 },   // Ramp down to 500 users
    { duration: '3m', target: 200 },   // Ramp down to 200 users
    { duration: '1m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests < 1s (more lenient for stress)
    http_req_failed: ['rate<0.2'],     // Error rate < 20% (more lenient for stress)
    errors: ['rate<0.2'],
  },
};

const BASE_URL = 'http://localhost:3001';

export function setup() {
  console.log('Starting stress test...');
}

export default function () {
  // Simulate different user behaviors
  const userBehavior = Math.random();
  
  if (userBehavior < 0.3) {
    // 30%: Heavy rating activity
    testRatingSubmission();
  } else if (userBehavior < 0.6) {
    // 30%: Trust score queries
    testTrustScoreQueries();
  } else if (userBehavior < 0.8) {
    // 20%: User profile browsing
    testUserBrowsing();
  } else {
    // 20%: Mixed operations
    testMixedOperations();
  }

  sleep(Math.random() * 2 + 0.5); // Random sleep 0.5-2.5s
}

function testRatingSubmission() {
  const response = http.post(`${BASE_URL}/api/v1/ratings/submit`, {
    raterId: `user${Math.floor(Math.random() * 10000)}`,
    rateeId: `user${Math.floor(Math.random() * 10000)}`,
    stars: Math.floor(Math.random() * 5) + 1,
    context: ['marketplace', 'services', 'general'][Math.floor(Math.random() * 3)],
    contextId: `tx${Math.floor(Math.random() * 100000)}`
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test-token-${Math.random()}`,
    }
  });

  const success = check(response, {
    'rating created successfully': (r) => [200, 201].includes(r.status),
    'rating response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
    ratingCreationRate.add(0);
  } else {
    ratingCreationRate.add(1);
  }
}

function testTrustScoreQueries() {
  const userId = `user${Math.floor(Math.random() * 1000)}`;
  
  const response = http.get(`${BASE_URL}/api/v1/trust/${userId}`, {
    headers: {
      'Authorization': `Bearer test-token-${Math.random()}`,
    }
  });

  const success = check(response, {
    'trust score retrieved': (r) => [200, 404].includes(r.status),
    'trust score response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    errorRate.add(1);
    trustScoreRate.add(0);
  } else {
    trustScoreRate.add(1);
  }
}

function testUserBrowsing() {
  const userId = `user${Math.floor(Math.random() * 1000)}`;
  
  // Browse user ratings
  const ratingsResponse = http.get(`${BASE_URL}/api/v1/ratings/user/${userId}?page=1&limit=20`, {
    headers: {
      'Authorization': `Bearer test-token-${Math.random()}`,
    }
  });

  check(ratingsResponse, {
    'ratings retrieved': (r) => r.status === 200,
    'ratings response time < 300ms': (r) => r.timings.duration < 300,
  });

  // Browse user reviews
  const reviewsResponse = http.get(`${BASE_URL}/api/v1/reviews/user/${userId}?page=1&limit=20`, {
    headers: {
      'Authorization': `Bearer test-token-${Math.random()}`,
    }
  });

  check(reviewsResponse, {
    'reviews retrieved': (r) => r.status === 200,
    'reviews response time < 300ms': (r) => r.timings.duration < 300,
  });
}

function testMixedOperations() {
  const operations = [
    () => http.get(`${BASE_URL}/api/v1/trust/leaderboard?limit=50`),
    () => http.get(`${BASE_URL}/api/v1/ratings/stats/user123`),
    () => http.get(`${BASE_URL}/health`),
    () => http.get(`${BASE_URL}/api/v1/trust/badge/verified`),
  ];

  const operation = operations[Math.floor(Math.random() * operations.length)];
  const response = operation();

  check(response, {
    'operation successful': (r) => r.status < 500,
    'operation response time < 1s': (r) => r.timings.duration < 1000,
  });
}

export function teardown() {
  console.log('Stress test completed');
}
