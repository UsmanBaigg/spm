/**
 * Security Monitoring and Logging Service
 * Comprehensive security event tracking and monitoring
 */

import crypto from 'crypto';
import { promisify } from 'util';

class SecurityMonitoringService {
  constructor() {
    this.securityEvents = [];
    this.alertThresholds = {
      failedLogins: 5,
      suspiciousActivity: 3,
      dataAccess: 50,
      privilegeEscalation: 1,
      systemChanges: 10
    };
    
    this.eventCounts = new Map();
    this.alertCooldowns = new Map();
    this.sessionTracking = new Map();
    
    this.severityLevels = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };

    this.eventTypes = {
      authentication: {
        login_success: { severity: 'low', category: 'auth' },
        login_failure: { severity: 'medium', category: 'auth' },
        logout: { severity: 'low', category: 'auth' },
        password_change: { severity: 'medium', category: 'auth' },
        account_locked: { severity: 'high', category: 'auth' },
        password_reset: { severity: 'medium', category: 'auth' }
      },
      authorization: {
        access_granted: { severity: 'low', category: 'authz' },
        access_denied: { severity: 'medium', category: 'authz' },
        privilege_escalation: { severity: 'high', category: 'authz' },
        role_change: { severity: 'medium', category: 'authz' }
      },
      data: {
        data_read: { severity: 'low', category: 'data' },
        data_write: { severity: 'medium', category: 'data' },
        data_delete: { severity: 'high', category: 'data' },
        data_export: { severity: 'medium', category: 'data' },
        sensitive_access: { severity: 'high', category: 'data' }
      },
      system: {
        config_change: { severity: 'medium', category: 'system' },
        system_start: { severity: 'low', category: 'system' },
        system_stop: { severity: 'medium', category: 'system' },
        error_occurred: { severity: 'medium', category: 'system' },
        security_breach: { severity: 'critical', category: 'system' }
      },
      fraud: {
        suspicious_rating: { severity: 'high', category: 'fraud' },
        suspicious_review: { severity: 'high', category: 'fraud' },
        account_takeover: { severity: 'critical', category: 'fraud' },
        bot_activity: { severity: 'medium', category: 'fraud' }
      }
    };
  }

  /**
   * Log security event
   */
  logSecurityEvent(eventType, details, context = {}) {
    const eventConfig = this.getEventConfig(eventType);
    if (!eventConfig) {
      console.warn(`Unknown security event type: ${eventType}`);
      return;
    }

    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      severity: eventConfig.severity,
      category: eventConfig.category,
      details,
      context: this.sanitizeContext(context),
      source: this.getEventSource(context),
      sessionId: context.sessionId || null,
      userId: context.userId || null,
      ip: context.ip || null,
      userAgent: context.userAgent || null,
      requestId: context.requestId || null
    };

    // Store event
    this.securityEvents.push(event);
    
    // Keep only last 10000 events in memory
    if (this.securityEvents.length > 10000) {
      this.securityEvents.shift();
    }

    // Update event counts
    this.updateEventCounts(eventType);

    // Check for alert conditions
    this.checkAlertConditions(event);

    // Log to console (in production, send to log aggregation service)
    this.logEvent(event);

    return event;
  }

  /**
   * Get event configuration
   */
  getEventConfig(eventType) {
    for (const category of Object.values(this.eventTypes)) {
      if (category[eventType]) {
        return category[eventType];
      }
    }
    return null;
  }

  /**
   * Sanitize context for logging
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove sensitive information
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.creditCard;
    
    // Mask sensitive fields
    if (sanitized.email) {
      sanitized.email = this.maskEmail(sanitized.email);
    }
    
    return sanitized;
  }

  /**
   * Mask email address
   */
  maskEmail(email) {
    if (!email) return null;
    const [username, domain] = email.split('@');
    const maskedUsername = username.slice(0, 2) + '*'.repeat(username.length - 2);
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Get event source
   */
  getEventSource(context) {
    return {
      service: context.service || 'trust-rating-api',
      version: context.version || '1.0.0',
      environment: context.environment || process.env.NODE_ENV || 'development',
      hostname: context.hostname || 'unknown',
      pid: context.pid || process.pid
    };
  }

  /**
   * Update event counts for monitoring
   */
  updateEventCounts(eventType) {
    const currentCount = this.eventCounts.get(eventType) || 0;
    this.eventCounts.set(eventType, currentCount + 1);
  }

  /**
   * Check alert conditions
   */
  checkAlertConditions(event) {
    const key = `${event.eventType}_${event.userId || 'anonymous'}`;
    
    // Check cooldown to prevent alert spam
    if (this.alertCooldowns.has(key)) {
      const lastAlert = this.alertCooldowns.get(key);
      if (Date.now() - lastAlert < 300000) { // 5 minutes
        return;
      }
    }

    // Check specific alert conditions
    switch (event.eventType) {
      case 'login_failure':
        this.checkFailedLoginAlert(event);
        break;
      case 'access_denied':
        this.checkAccessDeniedAlert(event);
        break;
      case 'privilege_escalation':
        this.triggerAlert(event, 'Privilege escalation detected');
        break;
      case 'account_takeover':
        this.triggerAlert(event, 'Possible account takeover');
        break;
      case 'security_breach':
        this.triggerAlert(event, 'Security breach detected');
        break;
      case 'suspicious_rating':
      case 'suspicious_review':
        this.checkFraudAlert(event);
        break;
    }

    // Check severity-based alerts
    if (event.severity === 'critical') {
      this.triggerAlert(event, 'Critical security event');
    }
  }

  /**
   * Check failed login alerts
   */
  checkFailedLoginAlert(event) {
    const userKey = `failed_login_${event.userId}`;
    const ipKey = `failed_login_${event.ip}`;
    
    const userCount = this.eventCounts.get(userKey) || 0;
    const ipCount = this.eventCounts.get(ipKey) || 0;
    
    if (userCount >= this.alertThresholds.failedLogins) {
      this.triggerAlert(event, `Multiple failed logins for user: ${event.userId}`);
    }
    
    if (ipCount >= this.alertThresholds.failedLogins) {
      this.triggerAlert(event, `Multiple failed logins from IP: ${event.ip}`);
    }
  }

  /**
   * Check access denied alerts
   */
  checkAccessDeniedAlert(event) {
    const userKey = `access_denied_${event.userId}`;
    const count = this.eventCounts.get(userKey) || 0;
    
    if (count >= this.alertThresholds.suspiciousActivity) {
      this.triggerAlert(event, `Multiple access denials for user: ${event.userId}`);
    }
  }

  /**
   * Check fraud alerts
   */
  checkFraudAlert(event) {
    const userKey = `fraud_${event.userId}`;
    const count = this.eventCounts.get(userKey) || 0;
    
    if (count >= this.alertThresholds.suspiciousActivity) {
      this.triggerAlert(event, `Suspicious activity detected for user: ${event.userId}`);
    }
  }

  /**
   * Trigger security alert
   */
  triggerAlert(event, message) {
    const alert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: event.severity,
      message,
      event,
      triggeredBy: 'security-monitoring-service'
    };

    // Log alert
    console.error(`🚨 SECURITY ALERT: ${message}`, alert);

    // Send to alerting systems (Slack, email, PagerDuty)
    this.sendAlert(alert);

    // Update cooldown
    const key = `${event.eventType}_${event.userId || 'anonymous'}`;
    this.alertCooldowns.set(key, Date.now());
  }

  /**
   * Send alert to external systems
   */
  async sendAlert(alert) {
    // Send to Slack
    if (process.env.SECURITY_SLACK_WEBHOOK) {
      await this.sendSlackAlert(alert);
    }

    // Send to email
    if (process.env.SECURITY_EMAIL_ENABLED === 'true') {
      await this.sendEmailAlert(alert);
    }

    // Send to PagerDuty
    if (process.env.PAGERDUTY_SECURITY_KEY && alert.severity === 'critical') {
      await this.sendPagerDutyAlert(alert);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const color = this.getAlertColor(alert.severity);
      const message = {
        text: `🚨 Security Alert: ${alert.message}`,
        attachments: [{
          color,
          fields: [
            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            { title: 'Event Type', value: alert.event.eventType, short: true },
            { title: 'User ID', value: alert.event.userId || 'Anonymous', short: true },
            { title: 'IP Address', value: alert.event.ip || 'Unknown', short: true },
            { title: 'Timestamp', value: alert.timestamp, short: true }
          ],
          footer: 'Security Monitoring System',
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
        }]
      };

      await fetch(process.env.SECURITY_SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    // Implementation would depend on email service
    console.log('📧 Email alert sent:', alert.message);
  }

  /**
   * Send PagerDuty alert
   */
  async sendPagerDutyAlert(alert) {
    try {
      const payload = {
        routing_key: process.env.PAGERDUTY_SECURITY_KEY,
        event_action: 'trigger',
        payload: {
          summary: alert.message,
          source: 'security-monitoring',
          severity: alert.severity,
          custom_details: alert
        }
      };

      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Failed to send PagerDuty alert:', error);
    }
  }

  /**
   * Get alert color
   */
  getAlertColor(severity) {
    switch (severity) {
      case 'low': return 'good';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      case 'critical': return '#8B0000';
      default: return 'gray';
    }
  }

  /**
   * Log event to console (in production, use proper logging service)
   */
  logEvent(event) {
    const logLevel = this.getLogLevel(event.severity);
    const message = `[SECURITY] ${event.eventType}: ${event.details.message || 'No message'}`;
    
    console.log(JSON.stringify({
      level: logLevel,
      message,
      event,
      timestamp: event.timestamp
    }));
  }

  /**
   * Get log level from severity
   */
  getLogLevel(severity) {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warn';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'info';
    }
  }

  /**
   * Track user session
   */
  trackSession(sessionId, userId, context) {
    this.sessionTracking.set(sessionId, {
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      ip: context.ip,
      userAgent: context.userAgent,
      deviceFingerprint: context.deviceFingerprint,
      events: []
    });
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId, event) {
    const session = this.sessionTracking.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      session.events.push({
        timestamp: new Date(),
        eventType: event.eventType,
        details: event.details
      });

      // Keep only last 50 events
      if (session.events.length > 50) {
        session.events.shift();
      }
    }
  }

  /**
   * End session
   */
  endSession(sessionId) {
    const session = this.sessionTracking.get(sessionId);
    if (session) {
      const duration = Date.now() - session.startTime.getTime();
      
      this.logSecurityEvent('session_end', {
        duration,
        eventCount: session.events.length,
        ip: session.ip,
        userAgent: session.userAgent
      }, {
        sessionId,
        userId: session.userId
      });

      this.sessionTracking.delete(sessionId);
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStatistics(timeRange = '24h') {
    const now = new Date();
    const timeRangeMs = this.parseTimeRange(timeRange);
    const cutoff = new Date(now.getTime() - timeRangeMs);

    const recentEvents = this.securityEvents.filter(event => 
      new Date(event.timestamp) > cutoff
    );

    const stats = {
      timeRange,
      totalEvents: recentEvents.length,
      eventsByType: {},
      eventsBySeverity: {},
      eventsByCategory: {},
      topUsers: {},
      topIPs: {},
      alertsTriggered: 0
    };

    // Aggregate statistics
    for (const event of recentEvents) {
      // By type
      stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
      
      // By severity
      stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
      
      // By category
      stats.eventsByCategory[event.category] = (stats.eventsByCategory[event.category] || 0) + 1;
      
      // Top users
      if (event.userId) {
        stats.topUsers[event.userId] = (stats.topUsers[event.userId] || 0) + 1;
      }
      
      // Top IPs
      if (event.ip) {
        stats.topIPs[event.ip] = (stats.topIPs[event.ip] || 0) + 1;
      }
    }

    // Sort and limit top lists
    stats.topUsers = Object.entries(stats.topUsers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [userId, count]) => ({ ...obj, [userId]: count }), {});

    stats.topIPs = Object.entries(stats.topIPs)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [ip, count]) => ({ ...obj, [ip]: count }), {});

    return stats;
  }

  /**
   * Parse time range to milliseconds
   */
  parseTimeRange(timeRange) {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000; // Default to 24 hours
    }
  }

  /**
   * Search security events
   */
  searchEvents(filters = {}) {
    let events = [...this.securityEvents];

    // Filter by time range
    if (filters.startTime) {
      events = events.filter(event => new Date(event.timestamp) >= new Date(filters.startTime));
    }
    
    if (filters.endTime) {
      events = events.filter(event => new Date(event.timestamp) <= new Date(filters.endTime));
    }

    // Filter by event type
    if (filters.eventType) {
      events = events.filter(event => event.eventType === filters.eventType);
    }

    // Filter by severity
    if (filters.severity) {
      events = events.filter(event => event.severity === filters.severity);
    }

    // Filter by user
    if (filters.userId) {
      events = events.filter(event => event.userId === filters.userId);
    }

    // Filter by IP
    if (filters.ip) {
      events = events.filter(event => event.ip === filters.ip);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    if (filters.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * Generate security report
   */
  generateSecurityReport(timeRange = '24h') {
    const stats = this.getSecurityStatistics(timeRange);
    const criticalEvents = this.searchEvents({
      startTime: new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString(),
      severity: 'critical'
    });

    const report = {
      generatedAt: new Date().toISOString(),
      timeRange,
      summary: {
        totalEvents: stats.totalEvents,
        criticalEvents: criticalEvents.length,
        riskLevel: this.calculateRiskLevel(stats),
        recommendations: this.generateRecommendations(stats)
      },
      statistics: stats,
      criticalEvents: criticalEvents.slice(0, 10), // Last 10 critical events
      activeSessions: this.sessionTracking.size,
      eventCounts: Object.fromEntries(this.eventCounts)
    };

    return report;
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel(stats) {
    const criticalCount = stats.eventsBySeverity.critical || 0;
    const highCount = stats.eventsBySeverity.high || 0;
    
    if (criticalCount > 0) {
      return 'critical';
    } else if (highCount > 5) {
      return 'high';
    } else if (highCount > 0) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(stats) {
    const recommendations = [];

    if ((stats.eventsBySeverity.critical || 0) > 0) {
      recommendations.push('Immediate investigation required for critical events');
    }

    if ((stats.eventsBySeverity.high || 0) > 10) {
      recommendations.push('Consider increasing monitoring frequency');
    }

    if ((stats.eventsByType.login_failure || 0) > 20) {
      recommendations.push('Implement stronger authentication measures');
    }

    if ((stats.eventsByCategory.fraud || 0) > 5) {
      recommendations.push('Review fraud detection algorithms');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture appears normal');
    }

    return recommendations;
  }
}

export default new SecurityMonitoringService();
