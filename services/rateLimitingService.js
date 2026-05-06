/**
 * Advanced Rate Limiting Service with User-Based Tiers
 * Implements sophisticated rate limiting based on user roles and behavior
 */

class RateLimitingService {
  constructor() {
    this.rateLimits = new Map(); // In production, use Redis
    this.userTiers = new Map();
    this.globalLimits = new Map();
    this.suspiciousUsers = new Map();
    
    this.defaultLimits = {
      guest: {
        requestsPerMinute: 20,
        requestsPerHour: 200,
        requestsPerDay: 1000,
        burstAllowance: 5,
        penaltyMultiplier: 1
      },
      user: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstAllowance: 10,
        penaltyMultiplier: 1
      },
      trusted_user: {
        requestsPerMinute: 120,
        requestsPerHour: 2000,
        requestsPerDay: 20000,
        burstAllowance: 20,
        penaltyMultiplier: 0.8
      },
      verified_user: {
        requestsPerMinute: 180,
        requestsPerHour: 3000,
        requestsPerDay: 30000,
        burstAllowance: 30,
        penaltyMultiplier: 0.7
      },
      moderator: {
        requestsPerMinute: 300,
        requestsPerHour: 5000,
        requestsPerDay: 50000,
        burstAllowance: 50,
        penaltyMultiplier: 0.5
      },
      admin: {
        requestsPerMinute: 600,
        requestsPerHour: 10000,
        requestsPerDay: 100000,
        burstAllowance: 100,
        penaltyMultiplier: 0.3
      },
      super_admin: {
        requestsPerMinute: 1200,
        requestsPerHour: 20000,
        requestsPerDay: 200000,
        burstAllowance: 200,
        penaltyMultiplier: 0.1
      }
    };

    this.endpointLimits = {
      'POST:/api/v1/auth/login': {
        guest: { requestsPerMinute: 5, requestsPerHour: 20 },
        user: { requestsPerMinute: 10, requestsPerHour: 50 }
      },
      'POST:/api/v1/auth/register': {
        guest: { requestsPerMinute: 3, requestsPerHour: 10 }
      },
      'POST:/api/v1/ratings/submit': {
        guest: { requestsPerMinute: 2, requestsPerHour: 10 },
        user: { requestsPerMinute: 10, requestsPerHour: 100 },
        trusted_user: { requestsPerMinute: 20, requestsPerHour: 200 }
      },
      'POST:/api/v1/reviews/create': {
        guest: { requestsPerMinute: 2, requestsPerHour: 10 },
        user: { requestsPerMinute: 5, requestsPerHour: 50 },
        trusted_user: { requestsPerMinute: 15, requestsPerHour: 150 }
      },
      'GET:/api/v1/trust/*': {
        guest: { requestsPerMinute: 30, requestsPerHour: 300 },
        user: { requestsPerMinute: 60, requestsPerHour: 600 }
      }
    };

    this.penalties = {
      rateLimitExceeded: {
        warningThreshold: 0.8,
        blockDuration: 300000, // 5 minutes
        penaltyIncrease: 1.2
      },
      suspiciousActivity: {
        warningThreshold: 0.6,
        blockDuration: 600000, // 10 minutes
        penaltyIncrease: 1.5
      },
      fraudDetected: {
        warningThreshold: 0.5,
        blockDuration: 1800000, // 30 minutes
        penaltyIncrease: 2.0
      }
    };
  }

  /**
   * Check rate limit for request
   */
  async checkRateLimit(identifier, endpoint, userRole = 'guest', context = {}) {
    const key = this.generateKey(identifier, endpoint);
    const limits = this.getEffectiveLimits(endpoint, userRole);
    
    // Get current usage
    const usage = this.getUsage(key);
    
    // Apply penalty multiplier if user is suspicious
    const penaltyMultiplier = this.getPenaltyMultiplier(identifier);
    const adjustedLimits = this.applyPenaltyMultiplier(limits, penaltyMultiplier);
    
    // Check all time windows
    const checks = [
      this.checkWindow(usage.minute, adjustedLimits.requestsPerMinute, 'minute'),
      this.checkWindow(usage.hour, adjustedLimits.requestsPerHour, 'hour'),
      this.checkWindow(usage.day, adjustedLimits.requestsPerDay, 'day')
    ];

    const result = {
      allowed: true,
      limit: adjustedLimits.requestsPerMinute,
      remaining: 0,
      resetTime: 0,
      retryAfter: 0,
      warnings: [],
      blocked: false
    };

    // Process checks
    for (const check of checks) {
      if (!check.allowed) {
        result.allowed = false;
        result.blocked = true;
        result.retryAfter = Math.max(result.retryAfter, check.retryAfter);
        
        // Apply penalty
        this.applyPenalty(identifier, 'rateLimitExceeded', endpoint);
        
        // Log rate limit violation
        this.logRateLimitViolation(identifier, endpoint, userRole, check.window);
      }
      
      if (check.warning) {
        result.warnings.push(`Approaching ${check.window} limit`);
      }
    }

    // Update current usage if allowed
    if (result.allowed) {
      this.updateUsage(key);
    }

    // Set remaining and reset time for current minute window
    const currentMinuteUsage = usage.minute.requests.length;
    result.remaining = Math.max(0, adjustedLimits.requestsPerMinute - currentMinuteUsage);
    result.resetTime = this.getNextResetTime('minute');
    result.limit = adjustedLimits.requestsPerMinute;

    return result;
  }

  /**
   * Generate rate limit key
   */
  generateKey(identifier, endpoint) {
    return `${identifier}:${endpoint}`;
  }

  /**
   * Get effective limits for user and endpoint
   */
  getEffectiveLimits(endpoint, userRole) {
    const baseLimits = { ...this.defaultLimits[userRole] || this.defaultLimits.guest };
    
    // Apply endpoint-specific overrides
    const endpointKey = `${endpoint.method}:${endpoint.path}`;
    const endpointOverride = this.endpointLimits[endpointKey];
    
    if (endpointOverride && endpointOverride[userRole]) {
      return {
        ...baseLimits,
        ...endpointOverride[userRole]
      };
    }
    
    return baseLimits;
  }

  /**
   * Get current usage statistics
   */
  getUsage(key) {
    const now = Date.now();
    const usage = this.rateLimits.get(key) || {
      minute: { requests: [], count: 0 },
      hour: { requests: [], count: 0 },
      day: { requests: [], count: 0 }
    };

    // Clean up old requests
    this.cleanupOldRequests(usage, now);

    return usage;
  }

  /**
   * Clean up old requests
   */
  cleanupOldRequests(usage, now) {
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    // Clean minute window
    usage.minute.requests = usage.minute.requests.filter(timestamp => timestamp > oneMinuteAgo);
    usage.minute.count = usage.minute.requests.length;

    // Clean hour window
    usage.hour.requests = usage.hour.requests.filter(timestamp => timestamp > oneHourAgo);
    usage.hour.count = usage.hour.requests.length;

    // Clean day window
    usage.day.requests = usage.day.requests.filter(timestamp => timestamp > oneDayAgo);
    usage.day.count = usage.day.requests.length;
  }

  /**
   * Check specific time window
   */
  checkWindow(windowUsage, limit, windowType) {
    const count = windowUsage.count;
    const ratio = count / limit;
    
    const result = {
      allowed: count < limit,
      window: windowType,
      current: count,
      limit: limit,
      ratio: ratio,
      warning: ratio >= 0.8,
      retryAfter: 0
    };

    if (!result.allowed) {
      const resetTime = this.getNextResetTime(windowType);
      result.retryAfter = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
    }

    return result;
  }

  /**
   * Get next reset time for window
   */
  getNextResetTime(windowType) {
    const now = new Date();
    
    switch (windowType) {
      case 'minute':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                       now.getHours(), now.getMinutes() + 1, 0, 0).getTime();
      case 'hour':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                       now.getHours() + 1, 0, 0, 0).getTime();
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 
                       0, 0, 0, 0).getTime();
      default:
        return now.getTime() + 60000;
    }
  }

  /**
   * Update usage statistics
   */
  updateUsage(key) {
    const now = Date.now();
    const usage = this.getUsage(key);
    
    usage.minute.requests.push(now);
    usage.hour.requests.push(now);
    usage.day.requests.push(now);
    
    this.rateLimits.set(key, usage);
  }

  /**
   * Get penalty multiplier for user
   */
  getPenaltyMultiplier(identifier) {
    const suspicious = this.suspiciousUsers.get(identifier);
    
    if (!suspicious) {
      return 1;
    }
    
    return suspicious.penaltyMultiplier || 1;
  }

  /**
   * Apply penalty multiplier to limits
   */
  applyPenaltyMultiplier(limits, multiplier) {
    return {
      ...limits,
      requestsPerMinute: Math.floor(limits.requestsPerMinute / multiplier),
      requestsPerHour: Math.floor(limits.requestsPerHour / multiplier),
      requestsPerDay: Math.floor(limits.requestsPerDay / multiplier),
      burstAllowance: Math.floor(limits.burstAllowance / multiplier)
    };
  }

  /**
   * Apply penalty to user
   */
  applyPenalty(identifier, penaltyType, endpoint) {
    const penalty = this.penalties[penaltyType];
    
    if (!penalty) {
      return;
    }

    const suspicious = this.suspiciousUsers.get(identifier) || {
      penaltyMultiplier: 1,
      violations: [],
      blockedUntil: 0
    };

    // Add violation
    suspicious.violations.push({
      type: penaltyType,
      endpoint,
      timestamp: new Date(),
      penaltyMultiplier: penalty.penaltyIncrease
    });

    // Update penalty multiplier
    suspicious.penaltyMultiplier *= penalty.penaltyIncrease;
    suspicious.penaltyMultiplier = Math.min(suspicious.penaltyMultiplier, 10); // Cap at 10x

    // Set block duration
    const blockUntil = Date.now() + penalty.blockDuration;
    if (blockUntil > suspicious.blockedUntil) {
      suspicious.blockedUntil = blockUntil;
    }

    this.suspiciousUsers.set(identifier, suspicious);
  }

  /**
   * Check if user is currently blocked
   */
  isUserBlocked(identifier) {
    const suspicious = this.suspiciousUsers.get(identifier);
    
    if (!suspicious) {
      return false;
    }

    // Check if block has expired
    if (Date.now() > suspicious.blockedUntil) {
      // Reduce penalty multiplier gradually
      suspicious.penaltyMultiplier = Math.max(1, suspicious.penaltyMultiplier * 0.9);
      suspicious.blockedUntil = 0;
      this.suspiciousUsers.set(identifier, suspicious);
      return false;
    }

    return true;
  }

  /**
   * Log rate limit violation
   */
  logRateLimitViolation(identifier, endpoint, userRole, window) {
    const violation = {
      identifier,
      endpoint: `${endpoint.method} ${endpoint.path}`,
      userRole,
      window,
      timestamp: new Date(),
      severity: this.getViolationSeverity(window)
    };

    // In production, send to security monitoring service
    console.warn(`🚨 Rate limit violation:`, violation);
  }

  /**
   * Get violation severity
   */
  getViolationSeverity(window) {
    switch (window) {
      case 'minute': return 'high';
      case 'hour': return 'medium';
      case 'day': return 'low';
      default: return 'medium';
    }
  }

  /**
   * Get user's current rate limit status
   */
  getUserRateLimitStatus(identifier, userRole = 'guest') {
    const status = {
      identifier,
      userRole,
      currentLimits: this.defaultLimits[userRole] || this.defaultLimits.guest,
      usage: {},
      penalties: this.suspiciousUsers.get(identifier) || null,
      isBlocked: this.isUserBlocked(identifier)
    };

    // Get usage for common endpoints
    const commonEndpoints = [
      { method: 'GET', path: '/api/v1/ratings/*' },
      { method: 'POST', path: '/api/v1/ratings/submit' },
      { method: 'GET', path: '/api/v1/trust/*' }
    ];

    for (const endpoint of commonEndpoints) {
      const key = this.generateKey(identifier, endpoint);
      const usage = this.getUsage(key);
      status.usage[`${endpoint.method} ${endpoint.path}`] = {
        minute: usage.minute.count,
        hour: usage.hour.count,
        day: usage.day.count
      };
    }

    return status;
  }

  /**
   * Reset user's rate limits (admin function)
   */
  resetUserRateLimits(identifier) {
    // Remove all rate limit data for user
    for (const [key] of this.rateLimits.entries()) {
      if (key.startsWith(`${identifier}:`)) {
        this.rateLimits.delete(key);
      }
    }

    // Reset penalties
    this.suspiciousUsers.delete(identifier);

    return true;
  }

  /**
   * Adjust user's rate limits (admin function)
   */
  adjustUserRateLimits(identifier, adjustments) {
    const customLimits = {
      ...this.defaultLimits.user,
      ...adjustments
    };

    this.userTiers.set(identifier, customLimits);
    return true;
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStatistics() {
    const stats = {
      totalKeys: this.rateLimits.size,
      suspiciousUsers: this.suspiciousUsers.size,
      blockedUsers: 0,
      averageUsage: {
        minute: 0,
        hour: 0,
        day: 0
      },
      topViolators: [],
      endpointUsage: {}
    };

    let totalMinuteUsage = 0;
    let totalHourUsage = 0;
    let totalDayUsage = 0;
    let keyCount = 0;

    // Calculate average usage
    for (const usage of this.rateLimits.values()) {
      totalMinuteUsage += usage.minute.count;
      totalHourUsage += usage.hour.count;
      totalDayUsage += usage.day.count;
      keyCount++;
    }

    if (keyCount > 0) {
      stats.averageUsage.minute = totalMinuteUsage / keyCount;
      stats.averageUsage.hour = totalHourUsage / keyCount;
      stats.averageUsage.day = totalDayUsage / keyCount;
    }

    // Count blocked users
    for (const suspicious of this.suspiciousUsers.values()) {
      if (Date.now() <= suspicious.blockedUntil) {
        stats.blockedUsers++;
      }
    }

    // Get top violators
    const violators = Array.from(this.suspiciousUsers.entries())
      .map(([identifier, data]) => ({
        identifier,
        violations: data.violations.length,
        penaltyMultiplier: data.penaltyMultiplier,
        blockedUntil: data.blockedUntil
      }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);

    stats.topViolators = violators;

    return stats;
  }

  /**
   * Create rate limit middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      const identifier = this.getIdentifier(req);
      const endpoint = {
        method: req.method,
        path: req.route?.path || req.path
      };
      const userRole = req.user?.role || 'guest';
      const context = {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      // Check if user is blocked
      if (this.isUserBlocked(identifier)) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'User temporarily blocked due to repeated violations',
          retryAfter: 300
        });
      }

      // Check rate limit
      this.checkRateLimit(identifier, endpoint, userRole, context)
        .then(result => {
          if (!result.allowed) {
            return res.status(429).json({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded',
              retryAfter: result.retryAfter,
              limit: result.limit,
              remaining: result.remaining,
              resetTime: result.resetTime
            });
          }

          // Add rate limit headers
          res.set({
            'X-RateLimit-Limit': result.limit,
            'X-RateLimit-Remaining': result.remaining,
            'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000)
          });

          // Add warning headers if approaching limits
          if (result.warnings.length > 0) {
            res.set('X-RateLimit-Warnings', result.warnings.join('; '));
          }

          next();
        })
        .catch(error => {
          console.error('Rate limiting error:', error);
          next(); // Allow request on error
        });
    };
  }

  /**
   * Get identifier for request
   */
  getIdentifier(req) {
    // Use user ID if authenticated
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }

    // Use IP address for unauthenticated requests
    return `ip:${req.ip}`;
  }

  /**
   * Burst allowance check
   */
  checkBurstAllowance(identifier, userRole = 'guest') {
    const limits = this.defaultLimits[userRole] || this.defaultLimits.guest;
    const key = `burst:${identifier}`;
    const usage = this.getUsage(key);
    
    return usage.minute.count < limits.burstAllowance;
  }

  /**
   * Adaptive rate limiting based on system load
   */
  getAdaptiveLimits(baseLimits, systemLoad) {
    const loadFactor = Math.max(0.1, 1 - systemLoad); // Reduce limits under high load
    
    return {
      ...baseLimits,
      requestsPerMinute: Math.floor(baseLimits.requestsPerMinute * loadFactor),
      requestsPerHour: Math.floor(baseLimits.requestsPerHour * loadFactor),
      requestsPerDay: Math.floor(baseLimits.requestsPerDay * loadFactor)
    };
  }

  /**
   * Rate limit based on content complexity
   */
  getContentBasedLimits(baseLimits, contentType, contentSize) {
    let multiplier = 1;

    // Adjust limits based on content type
    switch (contentType) {
      case 'application/json':
        multiplier = 1;
        break;
      case 'multipart/form-data':
        multiplier = 0.5; // File uploads are more expensive
        break;
      case 'text/plain':
        multiplier = 1.2;
        break;
      default:
        multiplier = 0.8;
    }

    // Further adjust based on content size
    if (contentSize > 1024 * 1024) { // > 1MB
      multiplier *= 0.5;
    } else if (contentSize > 100 * 1024) { // > 100KB
      multiplier *= 0.8;
    }

    return this.applyPenaltyMultiplier(baseLimits, 1 / multiplier);
  }
}

export default new RateLimitingService();
