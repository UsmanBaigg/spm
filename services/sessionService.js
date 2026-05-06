/**
 * Session Management and Token Blacklisting Service
 * Handles user sessions, token management, and security policies
 */

import crypto from 'crypto';
import { promisify } from 'util';

class SessionService {
  constructor() {
    this.sessions = new Map(); // In production, use Redis
    this.blacklistedTokens = new Map(); // In production, use Redis
    this.deviceSessions = new Map(); // Track sessions per device
    this.userSessions = new Map(); // Track sessions per user
    
    this.sessionConfig = {
      maxSessionsPerUser: 5,
      maxSessionsPerDevice: 3,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      absoluteTimeout: 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      tokenBlacklistDuration: 24 * 60 * 60 * 1000 // 24 hours
    };

    this.startCleanupTimer();
  }

  /**
   * Create new session
   */
  async createSession(userId, deviceInfo, authContext = {}) {
    const sessionId = crypto.randomUUID();
    const deviceFingerprint = this.generateDeviceFingerprint(deviceInfo);
    
    const session = {
      sessionId,
      userId,
      deviceFingerprint,
      deviceInfo: this.sanitizeDeviceInfo(deviceInfo),
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.sessionConfig.absoluteTimeout),
      ip: authContext.ip,
      userAgent: authContext.userAgent,
      location: authContext.location,
      isActive: true,
      securityFlags: {
        requiresReauth: false,
        suspiciousActivity: false,
        deviceTrusted: false
      }
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, []);
    }
    this.userSessions.get(userId).push(sessionId);

    // Track device sessions
    if (!this.deviceSessions.has(deviceFingerprint)) {
      this.deviceSessions.set(deviceFingerprint, []);
    }
    this.deviceSessions.get(deviceFingerprint).push(sessionId);

    // Enforce session limits
    await this.enforceSessionLimits(userId, deviceFingerprint);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      this.invalidateSession(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();

    return session;
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId, context = {}) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    session.lastActivity = new Date();
    
    // Update context if provided
    if (context.ip) session.ip = context.ip;
    if (context.userAgent) session.userAgent = context.userAgent;
    if (context.location) session.location = context.location;

    // Check for suspicious activity
    if (this.detectSuspiciousActivity(session, context)) {
      session.securityFlags.suspiciousActivity = true;
      this.flagSuspiciousSession(sessionId);
    }

    return true;
  }

  /**
   * Invalidate session
   */
  invalidateSession(sessionId, reason = 'logout') {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Mark as inactive
    session.isActive = false;
    session.invalidatedAt = new Date();
    session.invalidationReason = reason;

    // Remove from user sessions
    const userSessionList = this.userSessions.get(session.userId);
    if (userSessionList) {
      const index = userSessionList.indexOf(sessionId);
      if (index > -1) {
        userSessionList.splice(index, 1);
      }
    }

    // Remove from device sessions
    const deviceSessionList = this.deviceSessions.get(session.deviceFingerprint);
    if (deviceSessionList) {
      const index = deviceSessionList.indexOf(sessionId);
      if (index > -1) {
        deviceSessionList.splice(index, 1);
      }
    }

    return true;
  }

  /**
   * Invalidate all user sessions
   */
  invalidateAllUserSessions(userId, reason = 'security') {
    const userSessionList = this.userSessions.get(userId) || [];
    const invalidatedSessions = [];

    for (const sessionId of userSessionList) {
      if (this.invalidateSession(sessionId, reason)) {
        invalidatedSessions.push(sessionId);
      }
    }

    return invalidatedSessions;
  }

  /**
   * Invalidate all device sessions
   */
  invalidateAllDeviceSessions(deviceFingerprint, reason = 'security') {
    const deviceSessionList = this.deviceSessions.get(deviceFingerprint) || [];
    const invalidatedSessions = [];

    for (const sessionId of deviceSessionList) {
      if (this.invalidateSession(sessionId, reason)) {
        invalidatedSessions.push(sessionId);
      }
    }

    return invalidatedSessions;
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session) {
    const now = Date.now();
    
    // Check absolute timeout
    if (now > session.expiresAt.getTime()) {
      return true;
    }

    // Check inactivity timeout
    if (now - session.lastActivity.getTime() > this.sessionConfig.sessionTimeout) {
      return true;
    }

    return false;
  }

  /**
   * Enforce session limits
   */
  async enforceSessionLimits(userId, deviceFingerprint) {
    // Enforce per-user limit
    const userSessions = this.userSessions.get(userId) || [];
    if (userSessions.length > this.sessionConfig.maxSessionsPerUser) {
      // Remove oldest session
      const oldestSessionId = userSessions.shift();
      this.invalidateSession(oldestSessionId, 'session_limit_exceeded');
    }

    // Enforce per-device limit
    const deviceSessions = this.deviceSessions.get(deviceFingerprint) || [];
    if (deviceSessions.length > this.sessionConfig.maxSessionsPerDevice) {
      // Remove oldest session
      const oldestSessionId = deviceSessions.shift();
      this.invalidateSession(oldestSessionId, 'device_limit_exceeded');
    }
  }

  /**
   * Blacklist token
   */
  blacklistToken(token, reason = 'logout', duration = null) {
    const blacklistDuration = duration || this.sessionConfig.tokenBlacklistDuration;
    const expiresAt = new Date(Date.now() + blacklistDuration);

    this.blacklistedTokens.set(token, {
      token,
      blacklistedAt: new Date(),
      expiresAt,
      reason
    });

    return true;
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(token) {
    const blacklistEntry = this.blacklistedTokens.get(token);
    
    if (!blacklistEntry) {
      return false;
    }

    // Check if blacklist entry has expired
    if (Date.now() > blacklistEntry.expiresAt.getTime()) {
      this.blacklistedTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(deviceInfo) {
    const fingerprintData = [
      deviceInfo.userAgent || '',
      deviceInfo.language || '',
      deviceInfo.platform || '',
      deviceInfo.hardwareConcurrency || '',
      deviceInfo.deviceMemory || '',
      deviceInfo.screenResolution || '',
      deviceInfo.colorDepth || '',
      deviceInfo.timezone || ''
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintData).toString('hex');
  }

  /**
   * Sanitize device info for storage
   */
  sanitizeDeviceInfo(deviceInfo) {
    return {
      userAgent: deviceInfo.userAgent || 'unknown',
      language: deviceInfo.language || 'unknown',
      platform: deviceInfo.platform || 'unknown',
      hardwareConcurrency: deviceInfo.hardwareConcurrency || 0,
      deviceMemory: deviceInfo.deviceMemory || 0,
      screenResolution: deviceInfo.screenResolution || 'unknown',
      colorDepth: deviceInfo.colorDepth || 0,
      timezone: deviceInfo.timezone || 'unknown'
    };
  }

  /**
   * Detect suspicious activity
   */
  detectSuspiciousActivity(session, context) {
    // Check for IP changes
    if (context.ip && session.ip && context.ip !== session.ip) {
      return true;
    }

    // Check for rapid location changes
    if (context.location && session.location && 
        this.calculateDistance(session.location, context.location) > 1000) {
      return true;
    }

    // Check for unusual user agent changes
    if (context.userAgent && session.userAgent && 
        this.calculateStringSimilarity(context.userAgent, session.userAgent) < 0.5) {
      return true;
    }

    return false;
  }

  /**
   * Calculate distance between two locations (simplified)
   */
  calculateDistance(loc1, loc2) {
    // In production, use proper geolocation calculation
    // This is a simplified implementation
    if (!loc1 || !loc2 || !loc1.latitude || !loc2.latitude) {
      return 0;
    }

    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(loc2.latitude - loc1.latitude);
    const dLon = this.toRadians(loc2.longitude - loc1.longitude);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(loc1.latitude)) * Math.cos(this.toRadians(loc2.latitude)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate string similarity
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Flag suspicious session
   */
  flagSuspiciousSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.securityFlags.suspiciousActivity = true;
      session.securityFlags.requiresReauth = true;
      
      // In production, send alert to security team
      console.warn(`🚨 Suspicious session detected: ${sessionId}`);
    }
  }

  /**
   * Get active sessions for user
   */
  getUserActiveSessions(userId) {
    const userSessionList = this.userSessions.get(userId) || [];
    const activeSessions = [];

    for (const sessionId of userSessionList) {
      const session = this.getSession(sessionId);
      if (session && session.isActive) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Get active sessions for device
   */
  getDeviceActiveSessions(deviceFingerprint) {
    const deviceSessionList = this.deviceSessions.get(deviceFingerprint) || [];
    const activeSessions = [];

    for (const sessionId of deviceSessionList) {
      const session = this.getSession(sessionId);
      if (session && session.isActive) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Get session statistics
   */
  getSessionStatistics() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;
    let suspiciousCount = 0;

    for (const session of this.sessions.values()) {
      if (session.isActive) {
        if (this.isSessionExpired(session)) {
          expiredCount++;
        } else {
          activeCount++;
        }
      }

      if (session.securityFlags.suspiciousActivity) {
        suspiciousCount++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeCount,
      expiredSessions: expiredCount,
      suspiciousSessions: suspiciousCount,
      blacklistedTokens: this.blacklistedTokens.size,
      usersWithSessions: this.userSessions.size,
      devicesWithSessions: this.deviceSessions.size
    };
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupExpiredTokens();
    }, this.sessionConfig.cleanupInterval);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.invalidateSession(sessionId, 'expired');
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Clean up expired blacklisted tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, entry] of this.blacklistedTokens.entries()) {
      if (now > entry.expiresAt.getTime()) {
        this.blacklistedTokens.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired blacklisted tokens`);
    }
  }

  /**
   * Force reauthentication for user
   */
  forceReauthentication(userId, reason = 'security') {
    const userSessions = this.getUserActiveSessions(userId);
    const forcedSessions = [];

    for (const session of userSessions) {
      session.securityFlags.requiresReauth = true;
      session.securityFlags.reauthReason = reason;
      forcedSessions.push(session.sessionId);
    }

    return forcedSessions;
  }

  /**
   * Check if reauthentication is required
   */
  requiresReauthentication(sessionId) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return false;
    }

    return session.securityFlags.requiresReauth;
  }

  /**
   * Clear reauthentication requirement
   */
  clearReauthenticationRequirement(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.securityFlags.requiresReauth = false;
      session.securityFlags.reauthReason = null;
      return true;
    }

    return false;
  }

  /**
   * Get session security report
   */
  getSessionSecurityReport(userId = null) {
    const report = {
      generatedAt: new Date().toISOString(),
      statistics: this.getSessionStatistics(),
      suspiciousSessions: [],
      sessionsByUser: {},
      sessionsByDevice: {}
    };

    // Collect suspicious sessions
    for (const session of this.sessions.values()) {
      if (session.securityFlags.suspiciousActivity) {
        report.suspiciousSessions.push({
          sessionId: session.sessionId,
          userId: session.userId,
          deviceFingerprint: session.deviceFingerprint,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          ip: session.ip,
          userAgent: session.userAgent
        });
      }
    }

    // Group sessions by user
    if (userId) {
      const userSessions = this.getUserActiveSessions(userId);
      report.sessionsByUser[userId] = userSessions.map(session => ({
        sessionId: session.sessionId,
        deviceFingerprint: session.deviceFingerprint,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        ip: session.ip,
        isActive: session.isActive,
        requiresReauth: session.securityFlags.requiresReauth,
        suspiciousActivity: session.securityFlags.suspiciousActivity
      }));
    }

    return report;
  }
}

export default new SessionService();
