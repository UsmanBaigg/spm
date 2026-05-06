/**
 * JWT Authentication Service
 * Handles user authentication, token management, and session security
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { promisify } from 'util';

const randomBytes = promisify(crypto.randomBytes);

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtExpiry = process.env.JWT_EXPIRY || '15m';
    this.jwtRefreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    this.bcryptRounds = 12;
    this.blacklistedTokens = new Set(); // In production, use Redis
  }

  /**
   * Generate secure random token
   */
  async generateSecureToken(length = 32) {
    const bytes = await randomBytes(length);
    return bytes.toString('hex');
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(this.bcryptRounds);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry,
      issuer: 'trust-rating-system',
      audience: 'trust-rating-users',
      algorithm: 'HS256'
    });
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.jwtRefreshExpiry,
      issuer: 'trust-rating-system',
      audience: 'trust-rating-users',
      algorithm: 'HS256'
    });
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'trust-rating-system',
        audience: 'trust-rating-users',
        algorithms: ['HS256']
      });
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  /**
   * Verify JWT refresh token
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'trust-rating-system',
        audience: 'trust-rating-users',
        algorithms: ['HS256']
      });
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(token) {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Blacklist token (logout)
   */
  blacklistToken(token) {
    this.blacklistedTokens.add(token);
    
    // In production, set expiration based on token expiry
    const decoded = this.decodeToken(token);
    if (decoded && decoded.exp) {
      setTimeout(() => {
        this.blacklistedTokens.delete(token);
      }, (decoded.exp * 1000) - Date.now());
    }
  }

  /**
   * Decode token without verification (for extracting info)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  async generateTokenPair(user, deviceInfo = {}) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      deviceId: deviceInfo.deviceId || crypto.createHash('sha256').update(
        `${user.id}-${deviceInfo.userAgent || 'unknown'}`
      ).toString('hex'),
      sessionToken: await this.generateSecureToken(16)
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: payload.sessionToken
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(this.jwtExpiry),
      tokenType: 'Bearer',
      sessionId: payload.sessionToken
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    // Verify refresh token
    const decoded = this.verifyRefreshToken(refreshToken);
    
    // Check if refresh token is blacklisted
    if (this.isTokenBlacklisted(refreshToken)) {
      throw new Error('Refresh token has been revoked');
    }

    // Get user info (in production, fetch from database)
    const user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    // Generate new token pair
    const tokens = await this.generateTokenPair(user);
    
    // Blacklist old refresh token
    this.blacklistToken(refreshToken);

    return tokens;
  }

  /**
   * Parse expiry string to seconds
   */
  parseExpiry(expiry) {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // Default 15 minutes
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const requirements = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    };

    const checks = {
      length: password.length >= requirements.minLength,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      specialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const passed = Object.entries(checks)
      .filter(([key]) => requirements[`require${key.charAt(0).toUpperCase() + key.slice(1)}`])
      .every(([_, passed]) => passed);

    return {
      valid: passed,
      requirements,
      checks,
      score: Object.values(checks).filter(Boolean).length
    };
  }

  /**
   * Generate secure reset token
   */
  async generateResetToken(userId) {
    const token = await this.generateSecureToken(32);
    const hash = await this.hashPassword(token);
    
    // In production, store in database with expiration
    return {
      token,
      hash,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    };
  }

  /**
   * Verify reset token
   */
  async verifyResetToken(token, hash) {
    try {
      return await this.verifyPassword(token, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract user info from token
   */
  extractUserInfo(token) {
    try {
      const decoded = this.verifyAccessToken(token);
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        deviceId: decoded.deviceId,
        sessionId: decoded.sessionToken
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create session context for logging
   */
  createSessionContext(user, deviceInfo, ip) {
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: this.generateDeviceFingerprint(deviceInfo),
      timestamp: new Date().toISOString(),
      sessionId: crypto.randomUUID()
    };
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(deviceInfo) {
    const fingerprintData = [
      deviceInfo.userAgent || '',
      deviceInfo.language || '',
      deviceInfo.platform || '',
      deviceInfo.screenResolution || '',
      deviceInfo.timezone || ''
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintData).toString('hex');
  }

  /**
   * Rate limit authentication attempts
   */
  checkRateLimit(identifier, type = 'login') {
    // In production, use Redis with expiration
    const key = `${type}:${identifier}`;
    const attempts = this.getRateLimitAttempts(key);
    
    if (attempts >= 5) {
      throw new Error('Too many authentication attempts. Please try again later.');
    }
    
    this.incrementRateLimitAttempts(key);
  }

  /**
   * Get rate limit attempts (mock implementation)
   */
  getRateLimitAttempts(key) {
    // In production, use Redis: redis.get(key)
    return 0; // Mock implementation
  }

  /**
   * Increment rate limit attempts (mock implementation)
   */
  incrementRateLimitAttempts(key) {
    // In production, use Redis: redis.incr(key) + redis.expire(key, 300)
    // Mock implementation
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(userId) {
    // In production, invalidate all user sessions in database
    // For now, we'll mark all user tokens as invalid
    console.log(`Logging out all devices for user ${userId}`);
  }

  /**
   * Logout from specific device
   */
  async logoutFromDevice(userId, deviceId) {
    // In production, invalidate specific device session
    console.log(`Logging out device ${deviceId} for user ${userId}`);
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId) {
    // In production, fetch from database
    return []; // Mock implementation
  }
}

export default new AuthService();
