/**
 * API Key Management Service
 * Secure API key generation, management, and access control
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

class ApiKeyService {
  constructor() {
    this.apiKeys = new Map(); // In production, use database
    this.keyUsage = new Map();
    this.revokedKeys = new Map();
    
    this.keyTypes = {
      readonly: {
        permissions: ['read'],
        rateLimitMultiplier: 0.5,
        maxRequestsPerHour: 1000
      },
      readwrite: {
        permissions: ['read', 'write'],
        rateLimitMultiplier: 1.0,
        maxRequestsPerHour: 5000
      },
      admin: {
        permissions: ['read', 'write', 'delete', 'admin'],
        rateLimitMultiplier: 2.0,
        maxRequestsPerHour: 10000
      },
      service: {
        permissions: ['read', 'write', 'delete', 'admin'],
        rateLimitMultiplier: 5.0,
        maxRequestsPerHour: 50000,
        bypassRateLimit: true
      }
    };

    this.keyFormats = {
      standard: {
        prefix: 'tr_',
        length: 32,
        encoding: 'hex'
      },
      jwt: {
        algorithm: 'HS256',
        expiresIn: '1y'
      },
      uuid: {
        version: 4,
        prefix: 'tr_uuid_'
      }
    };

    this.securityPolicies = {
      keyRotation: 90, // days
      maxKeysPerUser: 10,
      minKeyLength: 32,
      requireHttps: true,
      allowIpWhitelist: true,
      allowDomainWhitelist: true
    };
  }

  /**
   * Generate new API key
   */
  async generateApiKey(userId, keyData = {}) {
    const keyId = crypto.randomUUID();
    const keyFormat = keyData.format || 'standard';
    
    let apiKey;
    let keyHash;

    switch (keyFormat) {
      case 'standard':
        apiKey = this.generateStandardKey();
        keyHash = this.hashKey(apiKey);
        break;
      case 'jwt':
        apiKey = this.generateJWTKey(userId, keyData);
        keyHash = this.hashKey(apiKey);
        break;
      case 'uuid':
        apiKey = this.generateUUIDKey();
        keyHash = this.hashKey(apiKey);
        break;
      default:
        throw new Error(`Unsupported key format: ${keyFormat}`);
    }

    const keyRecord = {
      keyId,
      keyHash,
      userId,
      name: keyData.name || `API Key ${new Date().toISOString()}`,
      type: keyData.type || 'readonly',
      format: keyFormat,
      permissions: this.keyTypes[keyData.type || 'readonly'].permissions,
      createdAt: new Date(),
      lastUsed: null,
      expiresAt: keyData.expiresAt || this.getDefaultExpiry(),
      isActive: true,
      usage: {
        totalRequests: 0,
        lastHourRequests: 0,
        lastDayRequests: 0
      },
      restrictions: {
        allowedIps: keyData.allowedIps || [],
        allowedDomains: keyData.allowedDomains || [],
        allowedEndpoints: keyData.allowedEndpoints || [],
        rateLimitMultiplier: this.keyTypes[keyData.type || 'readonly'].rateLimitMultiplier
      },
      metadata: {
        description: keyData.description || '',
        createdBy: keyData.createdBy || userId,
        purpose: keyData.purpose || ''
      }
    };

    // Store key record
    this.apiKeys.set(keyId, keyRecord);

    // Initialize usage tracking
    this.keyUsage.set(keyId, {
      requests: [],
      lastReset: new Date()
    });

    return {
      keyId,
      apiKey, // Only return the actual key on creation
      keyRecord: this.sanitizeKeyRecord(keyRecord)
    };
  }

  /**
   * Generate standard API key
   */
  generateStandardKey() {
    const format = this.keyFormats.standard;
    const randomBytes = crypto.randomBytes(format.length);
    const key = randomBytes.toString(format.encoding);
    return format.prefix + key;
  }

  /**
   * Generate JWT-based API key
   */
  generateJWTKey(userId, keyData) {
    const payload = {
      keyId: crypto.randomUUID(),
      userId,
      type: keyData.type || 'readonly',
      permissions: this.keyTypes[keyData.type || 'readonly'].permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
    };

    return jwt.sign(payload, process.env.JWT_API_KEY_SECRET || 'default-secret', {
      algorithm: this.keyFormats.jwt.algorithm
    });
  }

  /**
   * Generate UUID-based API key
   */
  generateUUIDKey() {
    const format = this.keyFormats.uuid;
    return format.prefix + crypto.randomUUID();
  }

  /**
   * Hash API key for storage
   */
  hashKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Get default expiry date
   */
  getDefaultExpiry() {
    const days = this.securityPolicies.keyRotation;
    return new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey, context = {}) {
    if (!apiKey) {
      return { valid: false, reason: 'Missing API key' };
    }

    let keyRecord;

    // Try different key formats
    if (apiKey.startsWith('tr_')) {
      keyRecord = await this.validateStandardKey(apiKey);
    } else if (apiKey.startsWith('tr_uuid_')) {
      keyRecord = await this.validateUUIDKey(apiKey);
    } else {
      // Try JWT validation
      keyRecord = await this.validateJWTKey(apiKey);
    }

    if (!keyRecord) {
      return { valid: false, reason: 'Invalid API key' };
    }

    // Check if key is active
    if (!keyRecord.isActive) {
      return { valid: false, reason: 'API key is inactive' };
    }

    // Check if key is expired
    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return { valid: false, reason: 'API key has expired' };
    }

    // Check if key is revoked
    if (this.revokedKeys.has(keyRecord.keyId)) {
      return { valid: false, reason: 'API key has been revoked' };
    }

    // Check IP restrictions
    if (keyRecord.restrictions.allowedIps.length > 0) {
      if (!keyRecord.restrictions.allowedIps.includes(context.ip)) {
        return { valid: false, reason: 'IP address not allowed' };
      }
    }

    // Check domain restrictions
    if (keyRecord.restrictions.allowedDomains.length > 0) {
      const origin = context.origin || context.referer;
      if (!origin || !keyRecord.restrictions.allowedDomains.some(domain => 
        origin.includes(domain))) {
        return { valid: false, reason: 'Domain not allowed' };
      }
    }

    // Update usage
    this.updateKeyUsage(keyRecord.keyId, context);

    return {
      valid: true,
      keyRecord: this.sanitizeKeyRecord(keyRecord),
      permissions: keyRecord.permissions
    };
  }

  /**
   * Validate standard API key
   */
  async validateStandardKey(apiKey) {
    const keyHash = this.hashKey(apiKey);
    
    for (const keyRecord of this.apiKeys.values()) {
      if (keyRecord.keyHash === keyHash && keyRecord.format === 'standard') {
        return keyRecord;
      }
    }
    
    return null;
  }

  /**
   * Validate UUID-based API key
   */
  async validateUUIDKey(apiKey) {
    const keyHash = this.hashKey(apiKey);
    
    for (const keyRecord of this.apiKeys.values()) {
      if (keyRecord.keyHash === keyHash && keyRecord.format === 'uuid') {
        return keyRecord;
      }
    }
    
    return null;
  }

  /**
   * Validate JWT-based API key
   */
  async validateJWTKey(apiKey) {
    try {
      const decoded = jwt.verify(apiKey, process.env.JWT_API_KEY_SECRET || 'default-secret', {
        algorithms: [this.keyFormats.jwt.algorithm]
      });

      // Find key record by keyId
      for (const keyRecord of this.apiKeys.values()) {
        if (keyRecord.keyId === decoded.keyId && keyRecord.format === 'jwt') {
          return keyRecord;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update key usage statistics
   */
  updateKeyUsage(keyId, context) {
    const usage = this.keyUsage.get(keyId);
    const keyRecord = this.apiKeys.get(keyId);
    
    if (usage && keyRecord) {
      const now = new Date();
      
      // Add request to usage log
      usage.requests.push({
        timestamp: now,
        ip: context.ip,
        endpoint: context.endpoint,
        method: context.method,
        statusCode: context.statusCode
      });

      // Keep only last 1000 requests
      if (usage.requests.length > 1000) {
        usage.requests.shift();
      }

      // Update key record
      keyRecord.lastUsed = now;
      keyRecord.usage.totalRequests++;

      // Calculate recent usage
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      keyRecord.usage.lastHourRequests = usage.requests.filter(
        req => new Date(req.timestamp) > oneHourAgo
      ).length;

      keyRecord.usage.lastDayRequests = usage.requests.filter(
        req => new Date(req.timestamp) > oneDayAgo
      ).length;
    }
  }

  /**
   * Revoke API key
   */
  revokeApiKey(keyId, reason = 'User request') {
    const keyRecord = this.apiKeys.get(keyId);
    
    if (!keyRecord) {
      return false;
    }

    keyRecord.isActive = false;
    keyRecord.revokedAt = new Date();
    keyRecord.revocationReason = reason;

    this.revokedKeys.set(keyId, {
      revokedAt: new Date(),
      reason
    });

    return true;
  }

  /**
   * Get user's API keys
   */
  getUserApiKeys(userId) {
    const userKeys = [];
    
    for (const keyRecord of this.apiKeys.values()) {
      if (keyRecord.userId === userId) {
        userKeys.push(this.sanitizeKeyRecord(keyRecord));
      }
    }

    return userKeys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Update API key
   */
  updateApiKey(keyId, updates, userId) {
    const keyRecord = this.apiKeys.get(keyId);
    
    if (!keyRecord || keyRecord.userId !== userId) {
      return false;
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'description', 'allowedIps', 'allowedDomains', 'expiresAt'];
    
    for (const [field, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(field)) {
        if (field === 'allowedIps' || field === 'allowedDomains') {
          keyRecord.restrictions[field] = value;
        } else if (field === 'description') {
          keyRecord.metadata[field] = value;
        } else {
          keyRecord[field] = value;
        }
      }
    }

    return this.sanitizeKeyRecord(keyRecord);
  }

  /**
   * Rotate API key
   */
  async rotateApiKey(keyId, userId) {
    const oldKeyRecord = this.apiKeys.get(keyId);
    
    if (!oldKeyRecord || oldKeyRecord.userId !== userId) {
      return false;
    }

    // Revoke old key
    this.revokeApiKey(keyId, 'Key rotation');

    // Generate new key with same properties
    const newKeyData = {
      name: oldKeyRecord.name,
      type: oldKeyRecord.type,
      format: oldKeyRecord.format,
      allowedIps: oldKeyRecord.restrictions.allowedIps,
      allowedDomains: oldKeyRecord.restrictions.allowedDomains,
      description: oldKeyRecord.metadata.description,
      purpose: oldKeyRecord.metadata.purpose
    };

    return await this.generateApiKey(userId, newKeyData);
  }

  /**
   * Check API key permissions
   */
  hasPermission(keyRecord, requiredPermission) {
    if (!keyRecord || !keyRecord.permissions) {
      return false;
    }

    return keyRecord.permissions.includes(requiredPermission) ||
           keyRecord.permissions.includes('admin');
  }

  /**
   * Get API key usage statistics
   */
  getKeyUsage(keyId, timeRange = '24h') {
    const usage = this.keyUsage.get(keyId);
    
    if (!usage) {
      return null;
    }

    const timeRangeMs = this.parseTimeRange(timeRange);
    const cutoff = new Date(Date.now() - timeRangeMs);

    const relevantRequests = usage.requests.filter(req => 
      new Date(req.timestamp) >= cutoff
    );

    const stats = {
      timeRange,
      totalRequests: relevantRequests.length,
      requestsByHour: {},
      requestsByEndpoint: {},
      requestsByStatus: {},
      averageResponseTime: 0,
      topIPs: {},
      errorRate: 0
    };

    let totalResponseTime = 0;
    let errorCount = 0;

    for (const request of relevantRequests) {
      // Group by hour
      const hour = new Date(request.timestamp).getHours();
      stats.requestsByHour[hour] = (stats.requestsByHour[hour] || 0) + 1;

      // Group by endpoint
      const endpoint = `${request.method} ${request.endpoint}`;
      stats.requestsByEndpoint[endpoint] = (stats.requestsByEndpoint[endpoint] || 0) + 1;

      // Group by status code
      const status = request.statusCode;
      stats.requestsByStatus[status] = (stats.requestsByStatus[status] || 0) + 1;

      // Track errors
      if (status >= 400) {
        errorCount++;
      }

      // Track IPs
      const ip = request.ip;
      stats.topIPs[ip] = (stats.topIPs[ip] || 0) + 1;

      // Response time (if available)
      if (request.responseTime) {
        totalResponseTime += request.responseTime;
      }
    }

    // Calculate averages
    if (relevantRequests.length > 0) {
      stats.averageResponseTime = totalResponseTime / relevantRequests.length;
      stats.errorRate = (errorCount / relevantRequests.length) * 100;
    }

    return stats;
  }

  /**
   * Get API key statistics
   */
  getApiKeyStatistics() {
    const stats = {
      totalKeys: this.apiKeys.size,
      activeKeys: 0,
      expiredKeys: 0,
      revokedKeys: this.revokedKeys.size,
      keysByType: {},
      keysByFormat: {},
      totalUsage: 0,
      topUsers: {},
      expiringSoon: []
    };

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    for (const keyRecord of this.apiKeys.values()) {
      // Active keys
      if (keyRecord.isActive && (!keyRecord.expiresAt || keyRecord.expiresAt > now)) {
        stats.activeKeys++;
      }

      // Expired keys
      if (keyRecord.expiresAt && keyRecord.expiresAt <= now) {
        stats.expiredKeys++;
      }

      // Keys by type
      stats.keysByType[keyRecord.type] = (stats.keysByType[keyRecord.type] || 0) + 1;

      // Keys by format
      stats.keysByFormat[keyRecord.format] = (stats.keysByFormat[keyRecord.format] || 0) + 1;

      // Total usage
      stats.totalUsage += keyRecord.usage.totalRequests;

      // Top users
      stats.topUsers[keyRecord.userId] = (stats.topUsers[keyRecord.userId] || 0) + 1;

      // Expiring soon
      if (keyRecord.expiresAt && keyRecord.expiresAt <= thirtyDaysFromNow && keyRecord.isActive) {
        stats.expiringSoon.push({
          keyId: keyRecord.keyId,
          name: keyRecord.name,
          userId: keyRecord.userId,
          expiresAt: keyRecord.expiresAt
        });
      }
    }

    return stats;
  }

  /**
   * Clean up expired keys
   */
  cleanupExpiredKeys() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [keyId, keyRecord] of this.apiKeys.entries()) {
      if (keyRecord.expiresAt && keyRecord.expiresAt <= now) {
        this.revokeApiKey(keyId, 'Key expired');
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Sanitize key record for response
   */
  sanitizeKeyRecord(keyRecord) {
    const sanitized = { ...keyRecord };
    delete sanitized.keyHash;
    return sanitized;
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
   * Create API key middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      const apiKey = req.get('X-API-Key') || req.get('Authorization')?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'API key required'
        });
      }

      const context = {
        ip: req.ip,
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        endpoint: req.path,
        method: req.method
      };

      this.validateApiKey(apiKey, context)
        .then(result => {
          if (!result.valid) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: result.reason
            });
          }

          // Attach key info to request
          req.apiKey = result.keyRecord;
          req.apiPermissions = result.permissions;

          next();
        })
        .catch(error => {
          console.error('API key validation error:', error);
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'API key validation failed'
          });
        });
    };
  }

  /**
   * Check rate limit for API key
   */
  checkKeyRateLimit(keyId, maxRequestsPerHour) {
    const keyRecord = this.apiKeys.get(keyId);
    
    if (!keyRecord) {
      return { allowed: false, reason: 'Key not found' };
    }

    const currentUsage = keyRecord.usage.lastHourRequests;
    const adjustedLimit = Math.floor(maxRequestsPerHour * keyRecord.restrictions.rateLimitMultiplier);

    return {
      allowed: currentUsage < adjustedLimit,
      current: currentUsage,
      limit: adjustedLimit,
      remaining: Math.max(0, adjustedLimit - currentUsage)
    };
  }
}

export default new ApiKeyService();
