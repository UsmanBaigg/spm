/**
 * Security Audit Logging and Compliance Service
 * Comprehensive audit trail for security and compliance requirements
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class AuditService {
  constructor() {
    this.auditLogs = [];
    this.complianceReports = new Map();
    this.auditPolicies = new Map();
    this.retentionPolicies = new Map();
    
    this.logLevels = {
      emergency: 0,
      alert: 1,
      critical: 2,
      error: 3,
      warning: 4,
      notice: 5,
      info: 6,
      debug: 7
    };

    this.complianceStandards = {
      GDPR: {
        dataRetention: 2555, // 7 years in days
        consentRequired: true,
        rightToBeForgotten: true,
        dataPortability: true,
        breachNotification: 72 // hours
      },
      SOC2: {
        accessControl: true,
        encryptionRequired: true,
        auditTrail: true,
        incidentResponse: true,
        vulnerabilityManagement: true
      },
      ISO27001: {
        informationSecurity: true,
        riskManagement: true,
        businessContinuity: true,
        complianceMonitoring: true
      },
      HIPAA: {
        phiProtection: true,
        accessLogs: true,
        auditControls: true,
        integrityControls: true
      }
    };

    this.initializeAuditPolicies();
    this.initializeRetentionPolicies();
  }

  /**
   * Initialize audit policies
   */
  initializeAuditPolicies() {
    const policies = {
      authentication: {
        required: true,
        logLevel: 'warning',
        fields: ['userId', 'action', 'result', 'ip', 'userAgent', 'timestamp'],
        retention: 2555 // 7 years
      },
      dataAccess: {
        required: true,
        logLevel: 'info',
        fields: ['userId', 'resource', 'action', 'result', 'ip', 'timestamp'],
        retention: 2555
      },
      dataModification: {
        required: true,
        logLevel: 'warning',
        fields: ['userId', 'resource', 'action', 'oldValue', 'newValue', 'ip', 'timestamp'],
        retention: 2555
      },
      privilegeEscalation: {
        required: true,
        logLevel: 'critical',
        fields: ['userId', 'oldRole', 'newRole', 'approvedBy', 'ip', 'timestamp'],
        retention: 2555
      },
      securityEvent: {
        required: true,
        logLevel: 'critical',
        fields: ['eventType', 'severity', 'description', 'affectedUsers', 'ip', 'timestamp'],
        retention: 2555
      },
      systemChange: {
        required: true,
        logLevel: 'warning',
        fields: ['changeType', 'description', 'performedBy', 'approvedBy', 'timestamp'],
        retention: 1825 // 5 years
      },
      failedLogin: {
        required: true,
        logLevel: 'warning',
        fields: ['userId', 'email', 'ip', 'userAgent', 'reason', 'timestamp'],
        retention: 365 // 1 year
      },
      apiAccess: {
        required: true,
        logLevel: 'info',
        fields: ['userId', 'endpoint', 'method', 'statusCode', 'responseTime', 'ip', 'timestamp'],
        retention: 730 // 2 years
      }
    };

    for (const [name, policy] of Object.entries(policies)) {
      this.auditPolicies.set(name, policy);
    }
  }

  /**
   * Initialize retention policies
   */
  initializeRetentionPolicies() {
    const policies = {
      authentication: 2555, // 7 years
      dataAccess: 2555, // 7 years
      dataModification: 2555, // 7 years
      securityEvents: 2555, // 7 years
      systemLogs: 365, // 1 year
      accessLogs: 730, // 2 years
      errorLogs: 90, // 3 months
      debugLogs: 30 // 1 month
    };

    for (const [category, days] of Object.entries(policies)) {
      this.retentionPolicies.set(category, days);
    }
  }

  /**
   * Log audit event
   */
  async logAuditEvent(eventType, details, context = {}) {
    const policy = this.auditPolicies.get(eventType);
    
    if (!policy) {
      console.warn(`No audit policy found for event type: ${eventType}`);
      return null;
    }

    const auditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      level: policy.logLevel,
      details: this.sanitizeDetails(details),
      context: this.sanitizeContext(context),
      compliance: {
        gdpr: this.checkGDPRCompliance(eventType, details),
        soc2: this.checkSOC2Compliance(eventType, details),
        iso27001: this.checkISO27001Compliance(eventType, details),
        hipaa: this.checkHIPAACompliance(eventType, details)
      },
      metadata: {
        source: process.env.SERVICE_NAME || 'trust-rating-api',
        version: process.env.SERVICE_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        instanceId: process.env.INSTANCE_ID || 'unknown'
      }
    };

    // Validate required fields
    const validation = this.validateAuditEvent(auditEvent, policy);
    if (!validation.valid) {
      console.error(`Audit event validation failed:`, validation.errors);
      return null;
    }

    // Store audit event
    this.auditLogs.push(auditEvent);
    
    // Keep only recent logs in memory (in production, use database)
    if (this.auditLogs.length > 10000) {
      this.auditLogs.shift();
    }

    // Write to persistent storage
    await this.writeAuditLog(auditEvent);

    // Check for compliance violations
    this.checkComplianceViolations(auditEvent);

    return auditEvent;
  }

  /**
   * Sanitize details for audit logging
   */
  sanitizeDetails(details) {
    const sanitized = { ...details };
    
    // Remove sensitive information
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.creditCard;
    delete sanitized.ssn;
    delete sanitized.phi; // Protected Health Information
    
    // Mask sensitive fields
    if (sanitized.email) {
      sanitized.email = this.maskEmail(sanitized.email);
    }
    
    if (sanitized.phoneNumber) {
      sanitized.phoneNumber = this.maskPhoneNumber(sanitized.phoneNumber);
    }

    return sanitized;
  }

  /**
   * Sanitize context for audit logging
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove sensitive headers
    if (sanitized.headers) {
      delete sanitized.headers.authorization;
      delete sanitized.headers.cookie;
      delete sanitized.headers['x-api-key'];
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
   * Mask phone number
   */
  maskPhoneNumber(phone) {
    if (!phone) return null;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * Validate audit event against policy
   */
  validateAuditEvent(event, policy) {
    const validation = {
      valid: true,
      errors: []
    };

    // Check required fields
    for (const field of policy.fields) {
      if (!this.hasNestedProperty(event, field)) {
        validation.valid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // Check timestamp
    if (!event.timestamp || isNaN(new Date(event.timestamp))) {
      validation.valid = false;
      validation.errors.push('Invalid or missing timestamp');
    }

    // Check event ID
    if (!event.id) {
      validation.valid = false;
      validation.errors.push('Missing event ID');
    }

    return validation;
  }

  /**
   * Check if object has nested property
   */
  hasNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined;
    }, obj);
  }

  /**
   * Write audit log to persistent storage
   */
  async writeAuditLog(event) {
    try {
      const logDir = process.env.AUDIT_LOG_DIR || './logs/audit';
      const logFile = path.join(logDir, `audit-${new Date().toISOString().split('T')[0]}.json`);
      
      // Ensure log directory exists
      await fs.mkdir(logDir, { recursive: true });
      
      // Append to log file
      const logEntry = JSON.stringify(event) + '\n';
      await fs.appendFile(logFile, logEntry);
      
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Check GDPR compliance
   */
  checkGDPRCompliance(eventType, details) {
    const gdpr = this.complianceStandards.GDPR;
    const compliance = {
      compliant: true,
      violations: []
    };

    // Check for personal data
    if (details.email || details.phoneNumber || details.userId) {
      if (!details.consent && gdpr.consentRequired) {
        compliance.compliant = false;
        compliance.violations.push('Missing consent for personal data processing');
      }
    }

    // Check data retention
    const policy = this.auditPolicies.get(eventType);
    if (policy && policy.retention > gdpr.dataRetention) {
      compliance.compliant = false;
      compliance.violations.push('Data retention period exceeds GDPR limits');
    }

    return compliance;
  }

  /**
   * Check SOC2 compliance
   */
  checkSOC2Compliance(eventType, details) {
    const soc2 = this.complianceStandards.SOC2;
    const compliance = {
      compliant: true,
      violations: []
    };

    // Check access control
    if (eventType === 'dataAccess' || eventType === 'dataModification') {
      if (!details.userId) {
        compliance.compliant = false;
        compliance.violations.push('Missing user identification for access control');
      }
    }

    // Check audit trail
    if (!details.timestamp) {
      compliance.compliant = false;
      compliance.violations.push('Missing timestamp for audit trail');
    }

    return compliance;
  }

  /**
   * Check ISO27001 compliance
   */
  checkISO27001Compliance(eventType, details) {
    const iso27001 = this.complianceStandards.ISO27001;
    const compliance = {
      compliant: true,
      violations: []
    };

    // Check information security
    if (eventType === 'securityEvent' && !details.severity) {
      compliance.compliant = false;
      compliance.violations.push('Missing severity for security event');
    }

    return compliance;
  }

  /**
   * Check HIPAA compliance
   */
  checkHIPAACompliance(eventType, details) {
    const hipaa = this.complianceStandards.HIPAA;
    const compliance = {
      compliant: true,
      violations: []
    };

    // Check PHI protection
    if (details.phi && !details.encrypted) {
      compliance.compliant = false;
      compliance.violations.push('Unencrypted PHI detected');
    }

    return compliance;
  }

  /**
   * Check for compliance violations
   */
  checkComplianceViolations(event) {
    const violations = [];

    for (const [standard, compliance] of Object.entries(event.compliance)) {
      if (!compliance.compliant) {
        violations.push({
          standard,
          violations: compliance.violations
        });
      }
    }

    if (violations.length > 0) {
      this.handleComplianceViolation(event, violations);
    }
  }

  /**
   * Handle compliance violation
   */
  handleComplianceViolation(event, violations) {
    const violation = {
      eventId: event.id,
      eventType: event.eventType,
      timestamp: event.timestamp,
      violations,
      severity: this.calculateViolationSeverity(violations)
    };

    console.error(`🚨 Compliance violation detected:`, violation);

    // In production, send to compliance team
    // Create incident report
    // Notify stakeholders
  }

  /**
   * Calculate violation severity
   */
  calculateViolationSeverity(violations) {
    const highRiskStandards = ['GDPR', 'HIPAA'];
    const hasHighRiskViolation = violations.some(v => 
      highRiskStandards.includes(v.standard)
    );

    if (hasHighRiskViolation) {
      return 'critical';
    } else if (violations.length > 2) {
      return 'high';
    } else if (violations.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Search audit logs
   */
  searchAuditLogs(filters = {}) {
    let logs = [...this.auditLogs];

    // Filter by event type
    if (filters.eventType) {
      logs = logs.filter(log => log.eventType === filters.eventType);
    }

    // Filter by level
    if (filters.level) {
      logs = logs.filter(log => log.level === filters.level);
    }

    // Filter by user ID
    if (filters.userId) {
      logs = logs.filter(log => 
        log.context.userId === filters.userId || 
        log.details.userId === filters.userId
      );
    }

    // Filter by time range
    if (filters.startTime) {
      const startTime = new Date(filters.startTime);
      logs = logs.filter(log => new Date(log.timestamp) >= startTime);
    }

    if (filters.endTime) {
      const endTime = new Date(filters.endTime);
      logs = logs.filter(log => new Date(log.timestamp) <= endTime);
    }

    // Filter by compliance standard
    if (filters.complianceStandard) {
      logs = logs.filter(log => {
        const compliance = log.compliance[filters.complianceStandard];
        return compliance && !compliance.compliant;
      });
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    if (filters.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(standard, timeRange = '30d') {
    const report = {
      standard,
      timeRange,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEvents: 0,
        compliantEvents: 0,
        nonCompliantEvents: 0,
        violations: []
      },
      details: {
        eventsByType: {},
        violationsByType: {},
        riskAssessment: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        }
      },
      recommendations: []
    };

    const timeRangeMs = this.parseTimeRange(timeRange);
    const cutoff = new Date(Date.now() - timeRangeMs);

    // Get relevant events
    const events = this.auditLogs.filter(log => 
      new Date(log.timestamp) >= cutoff
    );

    report.summary.totalEvents = events.length;

    for (const event of events) {
      const compliance = event.compliance[standard.toLowerCase()];
      
      if (compliance) {
        if (compliance.compliant) {
          report.summary.compliantEvents++;
        } else {
          report.summary.nonCompliantEvents++;
          
          // Add violations
          for (const violation of compliance.violations) {
            if (!report.summary.violations.includes(violation)) {
              report.summary.violations.push(violation);
            }
            
            report.details.violationsByType[violation] = 
              (report.details.violationsByType[violation] || 0) + 1;
          }
        }
      }

      // Group by event type
      report.details.eventsByType[event.eventType] = 
        (report.details.eventsByType[event.eventType] || 0) + 1;
    }

    // Generate recommendations
    report.recommendations = this.generateComplianceRecommendations(report);

    return report;
  }

  /**
   * Generate compliance recommendations
   */
  generateComplianceRecommendations(report) {
    const recommendations = [];

    if (report.summary.nonCompliantEvents > 0) {
      recommendations.push('Review and address compliance violations immediately');
    }

    if (report.summary.violations.includes('Missing consent for personal data processing')) {
      recommendations.push('Implement proper consent management for GDPR compliance');
    }

    if (report.summary.violations.includes('Missing user identification for access control')) {
      recommendations.push('Strengthen access control and user identification');
    }

    if (report.summary.violations.includes('Data retention period exceeds GDPR limits')) {
      recommendations.push('Review and adjust data retention policies');
    }

    if (report.summary.violations.includes('Unencrypted PHI detected')) {
      recommendations.push('Implement encryption for all PHI data');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring compliance requirements');
    }

    return recommendations;
  }

  /**
   * Parse time range to milliseconds
   */
  parseTimeRange(timeRange) {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));
    
    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      case 'y': return value * 365 * 24 * 60 * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000; // Default to 30 days
    }
  }

  /**
   * Export audit data for compliance
   */
  async exportAuditData(format = 'json', filters = {}) {
    const events = this.searchAuditLogs(filters);
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(events, null, 2);
      
      case 'csv':
        return this.convertToCSV(events);
      
      case 'xml':
        return this.convertToXML(events);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert events to CSV format
   */
  convertToCSV(events) {
    if (events.length === 0) {
      return '';
    }

    const headers = [
      'id', 'timestamp', 'eventType', 'level', 'userId', 'ip', 'userAgent'
    ];

    const csvRows = [headers.join(',')];

    for (const event of events) {
      const row = [
        event.id,
        event.timestamp,
        event.eventType,
        event.level,
        event.context.userId || event.details.userId || '',
        event.context.ip || '',
        event.context.userAgent || ''
      ];
      
      csvRows.push(row.map(field => `"${field}"`).join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Convert events to XML format
   */
  convertToXML(events) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<auditEvents>\n';
    
    for (const event of events) {
      xml += '  <event>\n';
      xml += `    <id>${event.id}</id>\n`;
      xml += `    <timestamp>${event.timestamp}</timestamp>\n`;
      xml += `    <eventType>${event.eventType}</eventType>\n`;
      xml += `    <level>${event.level}</level>\n`;
      xml += `    <userId>${event.context.userId || event.details.userId || ''}</userId>\n`;
      xml += `    <ip>${event.context.ip || ''}</ip>\n`;
      xml += '  </event>\n';
    }
    
    xml += '</auditEvents>';
    return xml;
  }

  /**
   * Handle data subject request (GDPR)
   */
  async handleDataSubjectRequest(userId, requestType) {
    const userData = this.searchAuditLogs({
      userId,
      startTime: new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000).toISOString() // 7 years
    });

    switch (requestType.toLowerCase()) {
      case 'access':
        return {
          userId,
          requestType: 'access',
          data: userData,
          generatedAt: new Date().toISOString()
        };
      
      case 'deletion':
        // In production, implement actual data deletion
        return {
          userId,
          requestType: 'deletion',
          status: 'processed',
          deletedRecords: userData.length,
          processedAt: new Date().toISOString()
        };
      
      case 'portability':
        return {
          userId,
          requestType: 'portability',
          data: userData,
          format: 'json',
          generatedAt: new Date().toISOString()
        };
      
      default:
        throw new Error(`Unsupported request type: ${requestType}`);
    }
  }

  /**
   * Get audit statistics
   */
  getAuditStatistics(timeRange = '24h') {
    const timeRangeMs = this.parseTimeRange(timeRange);
    const cutoff = new Date(Date.now() - timeRangeMs);

    const recentEvents = this.auditLogs.filter(log => 
      new Date(log.timestamp) >= cutoff
    );

    const stats = {
      timeRange,
      totalEvents: recentEvents.length,
      eventsByType: {},
      eventsByLevel: {},
      complianceStatus: {
        gdpr: { compliant: 0, violations: 0 },
        soc2: { compliant: 0, violations: 0 },
        iso27001: { compliant: 0, violations: 0 },
        hipaa: { compliant: 0, violations: 0 }
      },
      topUsers: {},
      topIPs: {}
    };

    for (const event of recentEvents) {
      // By type
      stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
      
      // By level
      stats.eventsByLevel[event.level] = (stats.eventsByLevel[event.level] || 0) + 1;
      
      // Compliance status
      for (const [standard, compliance] of Object.entries(event.compliance)) {
        if (compliance.compliant) {
          stats.complianceStatus[standard].compliant++;
        } else {
          stats.complianceStatus[standard].violations++;
        }
      }
      
      // Top users
      const userId = event.context.userId || event.details.userId;
      if (userId) {
        stats.topUsers[userId] = (stats.topUsers[userId] || 0) + 1;
      }
      
      // Top IPs
      const ip = event.context.ip;
      if (ip) {
        stats.topIPs[ip] = (stats.topIPs[ip] || 0) + 1;
      }
    }

    return stats;
  }
}

export default new AuditService();
