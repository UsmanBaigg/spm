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
      labelNames: ['method', 'route', 'status_code', 'user_role'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.httpRequestTotal = new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_role']
    });

    this.httpRequestSize = new prometheus.Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000]
    });

    this.httpResponseSize = new prometheus.Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000]
    });

    // Database metrics
    this.dbQueryDuration = new prometheus.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['collection', 'operation', 'index_used'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.dbConnectionsActive = new prometheus.Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections'
    });

    this.dbConnectionsTotal = new prometheus.Gauge({
      name: 'database_connections_total',
      help: 'Total number of database connections'
    });

    // Business metrics
    this.ratingsSubmitted = new prometheus.Counter({
      name: 'ratings_submitted_total',
      help: 'Total number of ratings submitted',
      labelNames: ['context', 'stars', 'user_role']
    });

    this.reviewsCreated = new prometheus.Counter({
      name: 'reviews_created_total',
      help: 'Total number of reviews created',
      labelNames: ['context', 'has_tags']
    });

    this.trustScoreCalculations = new prometheus.Counter({
      name: 'trust_score_calculations_total',
      help: 'Total number of trust score calculations'
    });

    this.activeUsers = new prometheus.Gauge({
      name: 'active_users_total',
      help: 'Number of active users'
    });

    this.totalRatings = new prometheus.Gauge({
      name: 'total_ratings_count',
      help: 'Total number of ratings in the system'
    });

    this.averageTrustScore = new prometheus.Gauge({
      name: 'average_trust_score',
      help: 'Average trust score across all users'
    });

    // Security metrics
    this.authenticationAttempts = new prometheus.Counter({
      name: 'authentication_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['result', 'method', 'ip']
    });

    this.securityEvents = new prometheus.Counter({
      name: 'security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'ip']
    });

    this.rateLimitViolations = new prometheus.Counter({
      name: 'rate_limit_violations_total',
      help: 'Total number of rate limit violations',
      labelNames: ['endpoint', 'ip', 'user_role']
    });

    // System metrics
    this.memoryUsage = new prometheus.Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes'
    });

    this.cpuUsage = new prometheus.Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage'
    });

    this.uptime = new prometheus.Gauge({
      name: 'uptime_seconds',
      help: 'Application uptime in seconds'
    });

    // Error metrics
    this.errorsTotal = new prometheus.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity', 'route']
    });

    this.panicsTotal = new prometheus.Counter({
      name: 'panics_total',
      help: 'Total number of application panics'
    });
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      const startHrTime = process.hrtime.bigint();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const hrDuration = Number(process.hrtime.bigint() - startHrTime) / 1000000000;
        const route = req.route?.path || req.path;
        const userRole = req.user?.role || 'anonymous';
        
        this.httpRequestDuration
          .labels(req.method, route, res.statusCode, userRole)
          .observe(hrDuration);
        
        this.httpRequestTotal
          .labels(req.method, route, res.statusCode, userRole)
          .inc();

        // Record request/response sizes
        if (req.headers['content-length']) {
          this.httpRequestSize
            .labels(req.method, route)
            .observe(parseInt(req.headers['content-length']));
        }

        if (res.headers['content-length']) {
          this.httpResponseSize
            .labels(req.method, route, res.statusCode)
            .observe(parseInt(res.headers['content-length']));
        }
      });
      
      next();
    };
  }

  recordRatingSubmitted(context, stars, userRole = 'user') {
    this.ratingsSubmitted.labels(context, stars.toString(), userRole).inc();
  }

  recordReviewCreated(context, hasTags = false, userRole = 'user') {
    this.reviewsCreated.labels(context, hasTags.toString()).inc();
  }

  recordTrustScoreCalculation() {
    this.trustScoreCalculations.inc();
  }

  updateActiveUsers(count) {
    this.activeUsers.set(count);
  }

  updateTotalRatings(count) {
    this.totalRatings.set(count);
  }

  updateAverageTrustScore(score) {
    this.averageTrustScore.set(score);
  }

  recordAuthenticationAttempt(result, method, ip = 'unknown') {
    this.authenticationAttempts.labels(result, method, ip).inc();
  }

  recordSecurityEvent(eventType, severity, ip = 'unknown') {
    this.securityEvents.labels(eventType, severity, ip).inc();
  }

  recordRateLimitViolation(endpoint, ip = 'unknown', userRole = 'anonymous') {
    this.rateLimitViolations.labels(endpoint, ip, userRole).inc();
  }

  recordDatabaseQuery(collection, operation, indexUsed = 'none', duration) {
    this.dbQueryDuration.labels(collection, operation, indexUsed).observe(duration);
  }

  updateDatabaseConnections(active, total) {
    this.dbConnectionsActive.set(active);
    this.dbConnectionsTotal.set(total);
  }

  recordError(type, severity = 'error', route = 'unknown') {
    this.errorsTotal.labels(type, severity, route).inc();
  }

  recordPanic() {
    this.panicsTotal.inc();
  }

  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.memoryUsage.set(memUsage.heapUsed);
    this.uptime.set(process.uptime());
  }

  async getMetrics() {
    this.updateSystemMetrics();
    return await register.metrics();
  }

  // Health check metrics
  getHealthStatus() {
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    return {
      status: memUsagePercent < 90 ? 'healthy' : 'warning',
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: memUsagePercent
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const metricsCollector = new MetricsCollector();

// Register default metrics
prometheus.collectDefaultMetrics({
  prefix: 'trust_rating_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

export default metricsCollector;
