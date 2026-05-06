import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let spikeHandlingRate = new Rate('spike_handling_success');

// Spike test configuration
export let options = {
  stages: [
    { duration: '2m', target: 10 },    // Baseline
    { duration: '30s', target: 500 },  // Spike up to 500 users
    { duration: '2m', target: 500 },  // Hold spike
    { duration: '30s', target: 10 },  // Spike down
    { duration: '2m', target: 10 },   // Recovery
    { duration: '30s', target: 1000 }, // Second spike
    { duration: '2m', target: 1000 }, // Hold second spike
    { duration: '30s', target: 10 },  // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests < 2s (very lenient for spikes)
    http_req_failed: ['rate<0.3'],     // Error rate < 30% during spikes
    errors: ['rate<0.3'],
  },
};

const BASE_URL = 'http://localhost:3001';

export function setup() {
  console.log('Starting spike test...');
}

export default function () {
  // Focus on critical endpoints during spikes
  const endpoints = [
    {
      name: 'health_check',
      method: 'GET',
      url: `${BASE_URL}/health`,
      expectedStatus: 200,
      timeout: 1000,
    },
    {
      name: 'trust_score',
      method: 'GET',
      url: `${BASE_URL}/api/v1/trust/user123`,
      expectedStatus: [200, 404],
      timeout: 2000,
    },
    {
      name: 'rating_stats',
      method: 'GET',
      url: `${BASE_URL}/api/v1/ratings/stats/user123`,
      expectedStatus: 200,
      timeout: 1500,
    },
    {
      name: 'leaderboard',
      method: 'GET',
      url: `${BASE_URL}/api/v1/trust/leaderboard?limit=10`,
      expectedStatus: 200,
      timeout: 2000,
    },
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const response = http.request(endpoint.method, endpoint.url, null, {
    headers: {
      'Authorization': `Bearer test-token-${Math.random()}`,
      'Content-Type': 'application/json',
    },
    timeout: endpoint.timeout,
  });

  const success = check(response, {
    [`${endpoint.name} status ok`]: (r) => {
      if (Array.isArray(endpoint.expectedStatus)) {
        return endpoint.expectedStatus.includes(r.status);
      }
      return r.status === endpoint.expectedStatus;
    },
    [`${endpoint.name} response time ok`]: (r) => r.timings.duration < endpoint.timeout,
    [`${endpoint.name} not overloaded`]: (r) => r.status !== 503,
  });

  if (!success) {
    errorRate.add(1);
    spikeHandlingRate.add(0);
  } else {
    spikeHandlingRate.add(1);
  }

  // Very short sleep during spikes to increase load
  sleep(Math.random() * 0.5 + 0.1);
}

export function teardown() {
  console.log('Spike test completed');
}
