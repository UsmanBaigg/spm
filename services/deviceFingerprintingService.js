/**
 * Device Fingerprinting Service
 * Advanced device identification and tracking for security
 */

import crypto from 'crypto';

class DeviceFingerprintingService {
  constructor() {
    this.deviceProfiles = new Map(); // In production, use database
    this.suspiciousDevices = new Map();
    this.deviceRiskScores = new Map();
    
    this.fingerprintComponents = {
      basic: ['userAgent', 'language', 'platform', 'cookieEnabled'],
      screen: ['screenWidth', 'screenHeight', 'colorDepth', 'pixelRatio'],
      hardware: ['hardwareConcurrency', 'deviceMemory', 'maxTouchPoints'],
      webgl: ['webglVendor', 'webglRenderer'],
      canvas: ['canvasFingerprint'],
      audio: ['audioFingerprint'],
      fonts: ['availableFonts'],
      timezone: ['timezone', 'timezoneOffset'],
      plugins: ['plugins'],
      connection: ['connectionType', 'effectiveType', 'downlink', 'rtt']
    };

    this.riskFactors = {
      vpnOrProxy: 30,
      headlessBrowser: 40,
      suspiciousUserAgent: 20,
      inconsistentFingerprint: 25,
      highFrequencyAccess: 15,
      multipleAccounts: 20,
      unusualTimezone: 10,
      botBehavior: 35
    };
  }

  /**
   * Generate comprehensive device fingerprint
   */
  async generateFingerprint(deviceData, context = {}) {
    const fingerprint = {
      id: null,
      components: {},
      hash: null,
      confidence: 0,
      riskScore: 0,
      riskFactors: [],
      createdAt: new Date(),
      lastSeen: new Date(),
      accessCount: 0,
      suspiciousActivity: false
    };

    // Collect fingerprint components
    fingerprint.components = await this.collectFingerprintComponents(deviceData);
    
    // Generate hash
    fingerprint.hash = this.generateHash(fingerprint.components);
    fingerprint.id = fingerprint.hash;

    // Calculate confidence
    fingerprint.confidence = this.calculateConfidence(fingerprint.components);
    
    // Assess risk
    const riskAssessment = this.assessDeviceRisk(fingerprint, context);
    fingerprint.riskScore = riskAssessment.score;
    fingerprint.riskFactors = riskAssessment.factors;

    // Store or update device profile
    await this.updateDeviceProfile(fingerprint);

    return fingerprint;
  }

  /**
   * Collect fingerprint components
   */
  async collectFingerprintComponents(deviceData) {
    const components = {};

    // Basic browser information
    components.basic = {
      userAgent: deviceData.userAgent || '',
      language: deviceData.language || '',
      platform: deviceData.platform || '',
      cookieEnabled: deviceData.cookieEnabled || false,
      doNotTrack: deviceData.doNotTrack || false
    };

    // Screen information
    components.screen = {
      screenWidth: deviceData.screenWidth || 0,
      screenHeight: deviceData.screenHeight || 0,
      colorDepth: deviceData.colorDepth || 0,
      pixelRatio: deviceData.pixelRatio || 1,
      availWidth: deviceData.availWidth || 0,
      availHeight: deviceData.availHeight || 0
    };

    // Hardware information
    components.hardware = {
      hardwareConcurrency: deviceData.hardwareConcurrency || 0,
      deviceMemory: deviceData.deviceMemory || 0,
      maxTouchPoints: deviceData.maxTouchPoints || 0,
      vendor: deviceData.vendor || '',
      deviceCategory: this.categorizeDevice(components)
    };

    // WebGL information
    components.webgl = {
      vendor: deviceData.webglVendor || '',
      renderer: deviceData.webglRenderer || '',
      version: deviceData.webglVersion || ''
    };

    // Canvas fingerprint
    components.canvas = {
      fingerprint: deviceData.canvasFingerprint || '',
      textFingerprint: deviceData.textFingerprint || ''
    };

    // Audio fingerprint
    components.audio = {
      fingerprint: deviceData.audioFingerprint || '',
      contextFingerprint: deviceData.audioContextFingerprint || ''
    };

    // Font fingerprint
    components.fonts = {
      available: deviceData.availableFonts || [],
      systemFonts: deviceData.systemFonts || [],
      webFonts: deviceData.webFonts || []
    };

    // Timezone information
    components.timezone = {
      timezone: deviceData.timezone || '',
      offset: deviceData.timezoneOffset || 0,
      dst: deviceData.dst || false
    };

    // Browser plugins
    components.plugins = {
      installed: deviceData.plugins || [],
      mimeTypes: deviceData.mimeTypes || []
    };

    // Network information
    components.connection = {
      type: deviceData.connectionType || '',
      effectiveType: deviceData.effectiveType || '',
      downlink: deviceData.downlink || 0,
      rtt: deviceData.rtt || 0,
      saveData: deviceData.saveData || false
    };

    // Additional security-relevant data
    components.security = {
      javaEnabled: deviceData.javaEnabled || false,
      pdfViewerEnabled: deviceData.pdfViewerEnabled || false,
      adBlocker: deviceData.adBlocker || false,
      trackingProtection: deviceData.trackingProtection || false
    };

    return components;
  }

  /**
   * Generate hash from components
   */
  generateHash(components) {
    const fingerprintString = this.normalizeComponents(components);
    return crypto.createHash('sha256').update(fingerprintString).toString('hex');
  }

  /**
   * Normalize components for hashing
   */
  normalizeComponents(components) {
    const normalized = [];

    // Add each component in a consistent order
    const orderedComponents = [
      'basic', 'screen', 'hardware', 'webgl', 'canvas', 
      'audio', 'fonts', 'timezone', 'plugins', 'connection', 'security'
    ];

    for (const componentName of orderedComponents) {
      const component = components[componentName];
      if (component) {
        normalized.push(JSON.stringify(component, Object.keys(component).sort()));
      }
    }

    return normalized.join('|');
  }

  /**
   * Calculate fingerprint confidence
   */
  calculateConfidence(components) {
    let confidence = 0;
    let totalComponents = 0;
    let availableComponents = 0;

    for (const [category, component] of Object.entries(components)) {
      totalComponents++;
      
      if (component && typeof component === 'object') {
        const filledFields = Object.values(component).filter(val => 
          val !== null && val !== undefined && val !== '' && val !== 0
        ).length;
        
        const totalFields = Object.keys(component).length;
        
        if (filledFields > 0) {
          availableComponents++;
          confidence += (filledFields / totalFields);
        }
      }
    }

    return totalComponents > 0 ? (confidence / totalComponents) * 100 : 0;
  }

  /**
   * Assess device risk
   */
  assessDeviceRisk(fingerprint, context) {
    const riskAssessment = {
      score: 0,
      factors: []
    };

    // Check for VPN/Proxy
    if (this.isVPNOrProxy(fingerprint, context)) {
      riskAssessment.score += this.riskFactors.vpnOrProxy;
      riskAssessment.factors.push('vpn_or_proxy');
    }

    // Check for headless browser
    if (this.isHeadlessBrowser(fingerprint)) {
      riskAssessment.score += this.riskFactors.headlessBrowser;
      riskAssessment.factors.push('headless_browser');
    }

    // Check for suspicious user agent
    if (this.isSuspiciousUserAgent(fingerprint.components.basic.userAgent)) {
      riskAssessment.score += this.riskFactors.suspiciousUserAgent;
      riskAssessment.factors.push('suspicious_user_agent');
    }

    // Check for inconsistent fingerprint
    if (this.isInconsistentFingerprint(fingerprint)) {
      riskAssessment.score += this.riskFactors.inconsistentFingerprint;
      riskAssessment.factors.push('inconsistent_fingerprint');
    }

    // Check for high frequency access
    if (this.isHighFrequencyAccess(fingerprint.id, context)) {
      riskAssessment.score += this.riskFactors.highFrequencyAccess;
      riskAssessment.factors.push('high_frequency_access');
    }

    // Check for multiple accounts
    if (this.isMultipleAccounts(fingerprint.id, context)) {
      riskAssessment.score += this.riskFactors.multipleAccounts;
      riskAssessment.factors.push('multiple_accounts');
    }

    // Check for unusual timezone
    if (this.isUnusualTimezone(fingerprint.components.timezone)) {
      riskAssessment.score += this.riskFactors.unusualTimezone;
      riskAssessment.factors.push('unusual_timezone');
    }

    // Check for bot behavior
    if (this.isBotBehavior(fingerprint, context)) {
      riskAssessment.score += this.riskFactors.botBehavior;
      riskAssessment.factors.push('bot_behavior');
    }

    return riskAssessment;
  }

  /**
   * Check if device is using VPN/Proxy
   */
  isVPNOrProxy(fingerprint, context) {
    // Check for common VPN/proxy indicators in user agent
    const userAgent = fingerprint.components.basic.userAgent.toLowerCase();
    const vpnIndicators = ['vpn', 'proxy', 'tor', 'anonymous'];
    
    if (vpnIndicators.some(indicator => userAgent.includes(indicator))) {
      return true;
    }

    // Check IP-based indicators (in production, use IP intelligence service)
    if (context.ip && this.isProxyIP(context.ip)) {
      return true;
    }

    // Check for timezone inconsistencies
    const timezone = fingerprint.components.timezone.timezone;
    if (timezone && this.isSuspiciousTimezone(timezone)) {
      return true;
    }

    return false;
  }

  /**
   * Check if browser is headless
   */
  isHeadlessBrowser(fingerprint) {
    const userAgent = fingerprint.components.basic.userAgent.toLowerCase();
    const headlessIndicators = ['headless', 'phantomjs', 'selenium', 'webdriver'];
    
    return headlessIndicators.some(indicator => userAgent.includes(indicator));
  }

  /**
   * Check for suspicious user agent
   */
  isSuspiciousUserAgent(userAgent) {
    if (!userAgent) return false;

    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /node/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check for inconsistent fingerprint
   */
  isInconsistentFingerprint(fingerprint) {
    const existingProfile = this.deviceProfiles.get(fingerprint.id);
    
    if (!existingProfile) {
      return false;
    }

    // Compare current fingerprint with stored one
    const similarity = this.calculateFingerprintSimilarity(
      fingerprint.components,
      existingProfile.components
    );

    return similarity < 0.8; // Less than 80% similarity is suspicious
  }

  /**
   * Check for high frequency access
   */
  isHighFrequencyAccess(deviceId, context) {
    const profile = this.deviceProfiles.get(deviceId);
    
    if (!profile) {
      return false;
    }

    // Check access frequency (mock implementation)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAccess = profile.accessHistory?.filter(
      access => new Date(access.timestamp) > oneHourAgo
    ) || [];

    return recentAccess.length > 100; // More than 100 accesses per hour
  }

  /**
   * Check for multiple accounts
   */
  isMultipleAccounts(deviceId, context) {
    const profile = this.deviceProfiles.get(deviceId);
    
    if (!profile) {
      return false;
    }

    // Check if device is associated with multiple user accounts
    const uniqueUsers = new Set(
      profile.accessHistory?.map(access => access.userId) || []
    );

    return uniqueUsers.size > 5; // More than 5 different users
  }

  /**
   * Check for unusual timezone
   */
  isUnusualTimezone(timezone) {
    // List of suspicious timezones (data centers, VPN servers)
    const suspiciousTimezones = [
      'UTC', 'GMT', 'EST', 'PST', 'CST', // Common server timezones
      'Asia/Shanghai', 'Europe/London', 'America/New_York' // Major data center locations
    ];

    return suspiciousTimezones.includes(timezone);
  }

  /**
   * Check for bot behavior
   */
  isBotBehavior(fingerprint, context) {
    // Check for bot-like characteristics
    const botIndicators = [];

    // No mouse/touch support
    if (fingerprint.components.hardware.maxTouchPoints === 0) {
      botIndicators.push('no_touch_support');
    }

    // No WebGL (common in headless browsers)
    if (!fingerprint.components.webgl.vendor) {
      botIndicators.push('no_webgl');
    }

    // Limited font support
    if (fingerprint.components.fonts.available.length < 10) {
      botIndicators.push('limited_fonts');
    }

    // No audio context
    if (!fingerprint.components.audio.fingerprint) {
      botIndicators.push('no_audio_context');
    }

    // Perfect screen resolution (unusual)
    const { screenWidth, screenHeight } = fingerprint.components.screen;
    if (screenWidth > 0 && screenHeight > 0) {
      const ratio = screenWidth / screenHeight;
      if (ratio === 16/9 || ratio === 4/3 || ratio === 1) {
        botIndicators.push('perfect_aspect_ratio');
      }
    }

    return botIndicators.length >= 3; // Multiple indicators suggest bot
  }

  /**
   * Check if IP is proxy (mock implementation)
   */
  isProxyIP(ip) {
    // In production, use real IP intelligence service
    const proxyRanges = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ];

    return false; // Mock implementation
  }

  /**
   * Check if timezone is suspicious
   */
  isSuspiciousTimezone(timezone) {
    const suspiciousTimezones = [
      'UTC',
      'GMT',
      'America/New_York',
      'Europe/London',
      'Asia/Shanghai'
    ];

    return suspiciousTimezones.includes(timezone);
  }

  /**
   * Calculate fingerprint similarity
   */
  calculateFingerprintSimilarity(components1, components2) {
    let totalComponents = 0;
    let matchingComponents = 0;

    for (const [category, component1] of Object.entries(components1)) {
      const component2 = components2[category];
      
      if (component1 && component2) {
        totalComponents++;
        
        if (this.compareComponents(component1, component2)) {
          matchingComponents++;
        }
      }
    }

    return totalComponents > 0 ? matchingComponents / totalComponents : 0;
  }

  /**
   * Compare two components
   */
  compareComponents(comp1, comp2) {
    // Simple comparison - in production, use more sophisticated comparison
    return JSON.stringify(comp1) === JSON.stringify(comp2);
  }

  /**
   * Categorize device
   */
  categorizeDevice(components) {
    const { basic, hardware, screen } = components;
    
    if (!basic.userAgent) {
      return 'unknown';
    }

    const userAgent = basic.userAgent.toLowerCase();
    
    // Mobile detection
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile';
    }
    
    // Tablet detection
    if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
      return 'tablet';
    }
    
    // Desktop detection
    if (hardware.maxTouchPoints === 0 && screen.screenWidth > 1024) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  /**
   * Update device profile
   */
  async updateDeviceProfile(fingerprint) {
    const existingProfile = this.deviceProfiles.get(fingerprint.id);
    
    if (existingProfile) {
      // Update existing profile
      existingProfile.lastSeen = new Date();
      existingProfile.accessCount = (existingProfile.accessCount || 0) + 1;
      
      // Update access history
      if (!existingProfile.accessHistory) {
        existingProfile.accessHistory = [];
      }
      
      existingProfile.accessHistory.push({
        timestamp: new Date(),
        ip: fingerprint.ip,
        userId: fingerprint.userId
      });
      
      // Keep only last 1000 access records
      if (existingProfile.accessHistory.length > 1000) {
        existingProfile.accessHistory.shift();
      }
      
      // Update risk score if increased
      if (fingerprint.riskScore > existingProfile.riskScore) {
        existingProfile.riskScore = fingerprint.riskScore;
        existingProfile.riskFactors = fingerprint.riskFactors;
      }
      
      // Mark as suspicious if risk is high
      if (fingerprint.riskScore > 70) {
        existingProfile.suspiciousActivity = true;
        this.flagSuspiciousDevice(fingerprint.id);
      }
    } else {
      // Create new profile
      const profile = {
        ...fingerprint,
        firstSeen: new Date(),
        accessHistory: fingerprint.userId ? [{
          timestamp: new Date(),
          ip: fingerprint.ip,
          userId: fingerprint.userId
        }] : [],
        trustScore: 100 - fingerprint.riskScore
      };
      
      this.deviceProfiles.set(fingerprint.id, profile);
    }
  }

  /**
   * Flag suspicious device
   */
  flagSuspiciousDevice(deviceId) {
    const profile = this.deviceProfiles.get(deviceId);
    
    if (profile) {
      profile.suspiciousActivity = true;
      profile.flaggedAt = new Date();
      
      // In production, send alert to security team
      console.warn(`🚨 Suspicious device flagged: ${deviceId}`);
    }
  }

  /**
   * Get device profile
   */
  getDeviceProfile(deviceId) {
    return this.deviceProfiles.get(deviceId) || null;
  }

  /**
   * Get device risk score
   */
  getDeviceRiskScore(deviceId) {
    const profile = this.deviceProfiles.get(deviceId);
    return profile ? profile.riskScore : 0;
  }

  /**
   * Get devices by risk level
   */
  getDevicesByRiskLevel(minRiskScore = 70) {
    const suspiciousDevices = [];
    
    for (const [deviceId, profile] of this.deviceProfiles.entries()) {
      if (profile.riskScore >= minRiskScore) {
        suspiciousDevices.push({
          deviceId,
          riskScore: profile.riskScore,
          riskFactors: profile.riskFactors,
          lastSeen: profile.lastSeen,
          accessCount: profile.accessCount,
          suspiciousActivity: profile.suspiciousActivity
        });
      }
    }
    
    return suspiciousDevices.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Get device statistics
   */
  getDeviceStatistics() {
    const stats = {
      totalDevices: this.deviceProfiles.size,
      suspiciousDevices: 0,
      highRiskDevices: 0,
      devicesByCategory: {},
      devicesByRiskLevel: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      averageRiskScore: 0
    };

    let totalRiskScore = 0;

    for (const profile of this.deviceProfiles.values()) {
      // Count suspicious devices
      if (profile.suspiciousActivity) {
        stats.suspiciousDevices++;
      }

      // Count by category
      const category = profile.deviceCategory || 'unknown';
      stats.devicesByCategory[category] = (stats.devicesByCategory[category] || 0) + 1;

      // Count by risk level
      if (profile.riskScore >= 80) {
        stats.devicesByRiskLevel.critical++;
        stats.highRiskDevices++;
      } else if (profile.riskScore >= 60) {
        stats.devicesByRiskLevel.high++;
      } else if (profile.riskScore >= 40) {
        stats.devicesByRiskLevel.medium++;
      } else {
        stats.devicesByRiskLevel.low++;
      }

      totalRiskScore += profile.riskScore;
    }

    stats.averageRiskScore = stats.totalDevices > 0 ? totalRiskScore / stats.totalDevices : 0;

    return stats;
  }

  /**
   * Generate device fingerprint report
   */
  generateDeviceReport(deviceId) {
    const profile = this.deviceProfiles.get(deviceId);
    
    if (!profile) {
      return null;
    }

    return {
      deviceId,
      riskScore: profile.riskScore,
      riskFactors: profile.riskFactors,
      suspiciousActivity: profile.suspiciousActivity,
      trustScore: profile.trustScore,
      firstSeen: profile.firstSeen,
      lastSeen: profile.lastSeen,
      accessCount: profile.accessCount,
      deviceCategory: profile.deviceCategory,
      components: profile.components,
      confidence: profile.confidence,
      accessHistory: profile.accessHistory.slice(-10), // Last 10 accesses
      recommendations: this.generateDeviceRecommendations(profile)
    };
  }

  /**
   * Generate device recommendations
   */
  generateDeviceRecommendations(profile) {
    const recommendations = [];

    if (profile.riskScore >= 80) {
      recommendations.push('Consider blocking this device');
      recommendations.push('Require additional verification');
    } else if (profile.riskScore >= 60) {
      recommendations.push('Monitor this device closely');
      recommendations.push('Limit access frequency');
    } else if (profile.riskScore >= 40) {
      recommendations.push('Monitor for unusual activity');
    }

    if (profile.suspiciousActivity) {
      recommendations.push('Investigate suspicious behavior');
    }

    if (profile.accessCount > 1000) {
      recommendations.push('Consider rate limiting this device');
    }

    return recommendations;
  }
}

export default new DeviceFingerprintingService();
