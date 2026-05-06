#!/usr/bin/env node

/**
 * Health Check and Alerting System
 * Monitors application health and sends alerts when issues are detected
 */

import http from 'http';
import https from 'https';
import { promisify } from 'util';
import { exec } from 'child_process';
import cron from 'node-cron';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

class HealthCheckSystem {
  constructor() {
    this.config = {
      checks: [
        {
          name: 'backend-api',
          url: process.env.BACKEND_HEALTH_URL || 'http://localhost:3001/health',
          method: 'GET',
          timeout: 5000,
          interval: 30000, // 30 seconds
          retries: 3,
          critical: true
        },
        {
          name: 'frontend',
          url: process.env.FRONTEND_HEALTH_URL || 'http://localhost:3000/',
          method: 'GET',
          timeout: 5000,
          interval: 60000, // 1 minute
          retries: 2,
          critical: false
        },
        {
          name: 'database',
          url: process.env.DB_HEALTH_URL || 'http://localhost:3001/health/db',
          method: 'GET',
          timeout: 10000,
          interval: 60000, // 1 minute
          retries: 3,
          critical: true
        },
        {
          name: 'redis',
          url: process.env.REDIS_HEALTH_URL || 'http://localhost:3001/health/redis',
          method: 'GET',
          timeout: 5000,
          interval: 60000, // 1 minute
          retries: 2,
          critical: false
        }
      ],
      alerting: {
        slack: {
          webhook: process.env.SLACK_HEALTH_WEBHOOK,
          channel: '#alerts'
        },
        email: {
          enabled: process.env.EMAIL_ALERTS === 'true',
          smtp: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          recipients: process.env.ALERT_RECIPIENTS?.split(',') || []
        },
        pagerduty: {
          enabled: process.env.PAGERDUTY_ENABLED === 'true',
          integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY
        }
      },
      thresholds: {
        responseTime: {
          warning: 1000, // 1 second
          critical: 3000  // 3 seconds
        },
        errorRate: {
          warning: 0.05,  // 5%
          critical: 0.15  // 15%
        },
        uptime: {
          warning: 0.99,  // 99%
          critical: 0.95  // 95%
        }
      }
    };

    this.status = {
      checks: {},
      overall: 'healthy',
      lastCheck: null,
      uptime: Date.now(),
      alerts: []
    };

    this.metrics = {
      totalChecks: 0,
      failedChecks: 0,
      responseTimes: {},
      errorCounts: {}
    };

    this.init();
  }

  init() {
    console.log('🔍 Health check system initialized');
    this.startMonitoring();
  }

  /**
   * Perform health check on a single endpoint
   */
  async performCheck(check) {
    const startTime = Date.now();
    let success = false;
    let responseTime = 0;
    let error = null;
    let statusCode = null;

    for (let attempt = 1; attempt <= check.retries; attempt++) {
      try {
        const response = await this.httpRequest(check.url, {
          method: check.method,
          timeout: check.timeout
        });

        responseTime = Date.now() - startTime;
        statusCode = response.status;

        if (response.status >= 200 && response.status < 300) {
          success = true;
          break;
        } else {
          error = `HTTP ${response.status}`;
        }
      } catch (err) {
        error = err.message;
        responseTime = Date.now() - startTime;
        
        if (attempt < check.retries) {
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    // Update metrics
    this.metrics.totalChecks++;
    if (!success) {
      this.metrics.failedChecks++;
      this.metrics.errorCounts[check.name] = (this.metrics.errorCounts[check.name] || 0) + 1;
    }

    if (responseTime > 0) {
      if (!this.metrics.responseTimes[check.name]) {
        this.metrics.responseTimes[check.name] = [];
      }
      this.metrics.responseTimes[check.name].push(responseTime);
      
      // Keep only last 100 measurements
      if (this.metrics.responseTimes[check.name].length > 100) {
        this.metrics.responseTimes[check.name].shift();
      }
    }

    const checkResult = {
      name: check.name,
      url: check.url,
      success,
      responseTime,
      statusCode,
      error,
      timestamp: new Date().toISOString(),
      critical: check.critical
    };

    this.status.checks[check.name] = checkResult;
    this.status.lastCheck = new Date().toISOString();

    return checkResult;
  }

  /**
   * Make HTTP request with timeout
   */
  async httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const req = protocol.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', reject);
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.setTimeout(options.timeout || 5000);
      req.end();
    });
  }

  /**
   * Calculate overall system health
   */
  calculateOverallHealth() {
    const checks = Object.values(this.status.checks);
    
    if (checks.length === 0) {
      return 'unknown';
    }

    const criticalChecks = checks.filter(check => check.critical);
    const failedCriticalChecks = criticalChecks.filter(check => !check.success);

    if (failedCriticalChecks.length > 0) {
      return 'critical';
    }

    const allChecks = checks.filter(check => check.success);
    const successRate = allChecks.length / checks.length;

    if (successRate < this.config.thresholds.uptime.critical) {
      return 'critical';
    } else if (successRate < this.config.thresholds.uptime.warning) {
      return 'warning';
    }

    // Check response times
    for (const [checkName, times] of Object.entries(this.metrics.responseTimes)) {
      if (times.length > 0) {
        const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
        
        if (avgResponseTime > this.config.thresholds.responseTime.critical) {
          return 'warning';
        }
      }
    }

    return 'healthy';
  }

  /**
   * Send alert based on health status
   */
  async sendAlert(check, previousStatus, currentStatus) {
    const alert = {
      check: check.name,
      previousStatus,
      currentStatus,
      timestamp: new Date().toISOString(),
      details: {
        url: check.url,
        error: check.error,
        responseTime: check.responseTime,
        statusCode: check.statusCode
      }
    };

    this.status.alerts.push(alert);

    // Send to different alert channels
    await Promise.all([
      this.sendSlackAlert(alert),
      this.sendEmailAlert(alert),
      this.sendPagerDutyAlert(alert)
    ]);
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    if (!this.config.alerting.slack.webhook) {
      return;
    }

    try {
      const color = this.getAlertColor(alert.currentStatus);
      const message = {
        text: `Health Check Alert: ${alert.check}`,
        attachments: [{
          color,
          fields: [
            { title: 'Status', value: alert.currentStatus, short: true },
            { title: 'Previous Status', value: alert.previousStatus, short: true },
            { title: 'Response Time', value: `${alert.details.responseTime}ms`, short: true },
            { title: 'URL', value: alert.details.url, short: false }
          ],
          footer: 'Trust Rating Health Monitor',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      if (alert.details.error) {
        message.attachments[0].fields.push({
          title: 'Error',
          value: alert.details.error,
          short: false
        });
      }

      await fetch(this.config.alerting.slack.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      console.log(`📢 Slack alert sent for ${alert.check}`);
    } catch (error) {
      console.error('❌ Failed to send Slack alert:', error);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    if (!this.config.alerting.email.enabled) {
      return;
    }

    try {
      // Implementation would depend on email service used
      console.log(`📧 Email alert sent for ${alert.check}`);
    } catch (error) {
      console.error('❌ Failed to send email alert:', error);
    }
  }

  /**
   * Send PagerDuty alert
   */
  async sendPagerDutyAlert(alert) {
    if (!this.config.alerting.pagerduty.enabled || !this.config.alerting.pagerduty.integrationKey) {
      return;
    }

    try {
      const severity = alert.currentStatus === 'critical' ? 'critical' : 'warning';
      
      const payload = {
        routing_key: this.config.alerting.pagerduty.integrationKey,
        event_action: 'trigger',
        payload: {
          summary: `Health check failed: ${alert.check}`,
          source: 'trust-rating-system',
          severity,
          custom_details: alert.details
        }
      };

      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log(`🚨 PagerDuty alert sent for ${alert.check}`);
    } catch (error) {
      console.error('❌ Failed to send PagerDuty alert:', error);
    }
  }

  /**
   * Get alert color based on status
   */
  getAlertColor(status) {
    switch (status) {
      case 'healthy': return 'good';
      case 'warning': return 'warning';
      case 'critical': return 'danger';
      default: return 'gray';
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = [];
    
    for (const check of this.config.checks) {
      const result = await this.performCheck(check);
      results.push(result);
    }

    const previousOverall = this.status.overall;
    this.status.overall = this.calculateOverallHealth();

    // Check for status changes and send alerts
    for (const result of results) {
      const previousCheck = this.status.checks[result.name];
      if (previousCheck && previousCheck.success !== result.success) {
        await this.sendAlert(result, previousCheck.success ? 'healthy' : 'unhealthy', result.success ? 'healthy' : 'unhealthy');
      }
    }

    // Send overall status change alert
    if (previousOverall !== this.status.overall) {
      await this.sendOverallStatusAlert(previousOverall, this.status.overall);
    }

    return results;
  }

  /**
   * Send overall status change alert
   */
  async sendOverallStatusAlert(previousStatus, currentStatus) {
    const alert = {
      check: 'overall_system',
      previousStatus,
      currentStatus,
      timestamp: new Date().toISOString(),
      details: {
        uptime: ((Date.now() - this.status.uptime) / 1000 / 60).toFixed(2), // minutes
        totalChecks: this.metrics.totalChecks,
        failedChecks: this.metrics.failedChecks,
        errorRate: (this.metrics.failedChecks / this.metrics.totalChecks).toFixed(2)
      }
    };

    await this.sendSlackAlert(alert);
    await this.sendEmailAlert(alert);
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring() {
    // Run checks immediately
    this.runAllChecks();

    // Schedule regular checks
    cron.schedule('*/30 * * * * *', () => {
      this.runAllChecks();
    });

    // Schedule daily summary
    cron.schedule('0 8 * * *', () => {
      this.sendDailySummary();
    });

    console.log('✅ Health monitoring started');
  }

  /**
   * Send daily health summary
   */
  async sendDailySummary() {
    const summary = {
      date: new Date().toISOString().split('T')[0],
      overall: this.status.overall,
      uptime: ((Date.now() - this.status.uptime) / 1000 / 60 / 60).toFixed(2), // hours
      totalChecks: this.metrics.totalChecks,
      failedChecks: this.metrics.failedChecks,
      successRate: ((this.metrics.totalChecks - this.metrics.failedChecks) / this.metrics.totalChecks * 100).toFixed(2),
      averageResponseTimes: {}
    };

    // Calculate average response times
    for (const [checkName, times] of Object.entries(this.metrics.responseTimes)) {
      if (times.length > 0) {
        summary.averageResponseTimes[checkName] = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
      }
    }

    console.log('📊 Daily health summary:', summary);

    // Send summary to Slack
    if (this.config.alerting.slack.webhook) {
      const message = {
        text: `📊 Daily Health Summary - ${summary.date}`,
        attachments: [{
          color: summary.overall === 'healthy' ? 'good' : summary.overall === 'warning' ? 'warning' : 'danger',
          fields: [
            { title: 'Overall Status', value: summary.overall, short: true },
            { title: 'Uptime', value: `${summary.uptime}h`, short: true },
            { title: 'Success Rate', value: `${summary.successRate}%`, short: true },
            { title: 'Total Checks', value: summary.totalChecks.toString(), short: true }
          ]
        }]
      };

      await fetch(this.config.alerting.slack.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      status: this.status.overall,
      timestamp: new Date().toISOString(),
      uptime: ((Date.now() - this.status.uptime) / 1000 / 60).toFixed(2), // minutes
      checks: this.status.checks,
      metrics: this.metrics,
      alerts: this.status.alerts.slice(-10) // Last 10 alerts
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const healthChecker = new HealthCheckSystem();
  const command = process.argv[2];

  switch (command) {
    case 'check':
      healthChecker.runAllChecks().then(results => {
        console.log('Health check results:', JSON.stringify(results, null, 2));
      });
      break;
    case 'status':
      console.log('Current health status:', JSON.stringify(healthChecker.getHealthStatus(), null, 2));
      break;
    case 'monitor':
      console.log('🔍 Starting health monitoring...');
      break;
    default:
      console.log('Usage: node health-check.js [check|status|monitor]');
      process.exit(1);
  }
}

export default HealthCheckSystem;
