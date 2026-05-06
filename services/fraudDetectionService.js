/**
 * Advanced Fraud Detection Service
 * Detects and prevents fraudulent activities using multiple algorithms
 */

class FraudDetectionService {
  constructor() {
    this.suspiciousPatterns = new Map();
    this.userRiskScores = new Map();
    this.ipRiskScores = new Map();
    this.deviceRiskScores = new Map();
    this.recentActivities = new Map();
    
    this.thresholds = {
      highRiskScore: 80,
      mediumRiskScore: 60,
      maxRatingsPerHour: 20,
      maxReviewsPerHour: 15,
      maxAccountAgeDays: 1,
      suspiciousRatingPatterns: ['perfect_scores', 'rapid_ratings', 'reciprocal_ratings'],
      suspiciousReviewPatterns: ['duplicate_content', 'spam_keywords', 'unnatural_language']
    };

    this.initializeSuspiciousPatterns();
  }

  /**
   * Initialize suspicious patterns
   */
  initializeSuspiciousPatterns() {
    // Rating patterns
    this.suspiciousPatterns.set('perfect_scores', {
      description: 'User gives only 5-star ratings',
      weight: 0.3
    });

    this.suspiciousPatterns.set('rapid_ratings', {
      description: 'User submits ratings too quickly',
      weight: 0.4
    });

    this.suspiciousPatterns.set('reciprocal_ratings', {
      description: 'Users exchange high ratings',
      weight: 0.5
    });

    this.suspiciousPatterns.set('same_day_multiple', {
      description: 'Multiple ratings to same user on same day',
      weight: 0.3
    });

    // Review patterns
    this.suspiciousPatterns.set('duplicate_content', {
      description: 'Identical or very similar review content',
      weight: 0.6
    });

    this.suspiciousPatterns.set('spam_keywords', {
      description: 'Review contains spam-like keywords',
      weight: 0.4
    });

    this.suspiciousPatterns.set('unnatural_language', {
      description: 'Review uses unnatural language patterns',
      weight: 0.3
    });

    // Account patterns
    this.suspiciousPatterns.set('new_account_burst', {
      description: 'New account with high activity',
      weight: 0.5
    });

    this.suspiciousPatterns.set('vpn_or_proxy', {
      description: 'User connects via VPN or proxy',
      weight: 0.2
    });

    this.suspiciousPatterns.set('multiple_devices', {
      description: 'Account used from many devices simultaneously',
      weight: 0.3
    });
  }

  /**
   * Analyze rating for fraud indicators
   */
  async analyzeRating(ratingData, context) {
    const fraudIndicators = [];
    let riskScore = 0;

    // Check user account age
    const accountAgeRisk = this.checkAccountAge(context.userCreatedAt);
    if (accountAgeRisk > 0) {
      fraudIndicators.push({
        type: 'new_account_rating',
        description: 'Rating from very new account',
        score: accountAgeRisk
      });
      riskScore += accountAgeRisk;
    }

    // Check rating frequency
    const frequencyRisk = this.checkRatingFrequency(context.userId, ratingData.createdAt);
    if (frequencyRisk > 0) {
      fraudIndicators.push({
        type: 'high_frequency_rating',
        description: 'Too many ratings in short time',
        score: frequencyRisk
      });
      riskScore += frequencyRisk;
    }

    // Check for perfect score pattern
    const perfectScoreRisk = this.checkPerfectScorePattern(context.userId, ratingData.stars);
    if (perfectScoreRisk > 0) {
      fraudIndicators.push({
        type: 'perfect_score_pattern',
        description: 'User consistently gives perfect scores',
        score: perfectScoreRisk
      });
      riskScore += perfectScoreRisk;
    }

    // Check for reciprocal ratings
    const reciprocalRisk = this.checkReciprocalRating(context.userId, ratingData.rateeId);
    if (reciprocalRisk > 0) {
      fraudIndicators.push({
        type: 'reciprocal_rating',
        description: 'Possible reciprocal rating exchange',
        score: reciprocalRisk
      });
      riskScore += reciprocalRisk;
    }

    // Check IP-based risk
    const ipRisk = await this.checkIPRisk(context.ip);
    if (ipRisk > 0) {
      fraudIndicators.push({
        type: 'suspicious_ip',
        description: 'Rating from suspicious IP address',
        score: ipRisk
      });
      riskScore += ipRisk;
    }

    // Check device risk
    const deviceRisk = this.checkDeviceRisk(context.deviceFingerprint);
    if (deviceRisk > 0) {
      fraudIndicators.push({
        type: 'suspicious_device',
        description: 'Rating from suspicious device',
        score: deviceRisk
      });
      riskScore += deviceRisk;
    }

    return {
      riskScore: Math.min(riskScore, 100),
      riskLevel: this.getRiskLevel(riskScore),
      indicators: fraudIndicators,
      recommendation: this.getRecommendation(riskScore)
    };
  }

  /**
   * Analyze review for fraud indicators
   */
  async analyzeReview(reviewData, context) {
    const fraudIndicators = [];
    let riskScore = 0;

    // Check for duplicate content
    const duplicateRisk = this.checkDuplicateContent(reviewData.content, context.userId);
    if (duplicateRisk > 0) {
      fraudIndicators.push({
        type: 'duplicate_content',
        description: 'Review content appears to be duplicate',
        score: duplicateRisk
      });
      riskScore += duplicateRisk;
    }

    // Check for spam keywords
    const spamRisk = this.checkSpamKeywords(reviewData.content);
    if (spamRisk > 0) {
      fraudIndicators.push({
        type: 'spam_keywords',
        description: 'Review contains spam-like keywords',
        score: spamRisk
      });
      riskScore += spamRisk;
    }

    // Check language patterns
    const languageRisk = this.checkLanguagePatterns(reviewData.content);
    if (languageRisk > 0) {
      fraudIndicators.push({
        type: 'unnatural_language',
        description: 'Review uses unnatural language patterns',
        score: languageRisk
      });
      riskScore += languageRisk;
    }

    // Check review frequency
    const frequencyRisk = this.checkReviewFrequency(context.userId, reviewData.createdAt);
    if (frequencyRisk > 0) {
      fraudIndicators.push({
        type: 'high_frequency_review',
        description: 'Too many reviews in short time',
        score: frequencyRisk
      });
      riskScore += frequencyRisk;
    }

    // Check review length patterns
    const lengthRisk = this.checkReviewLengthPatterns(reviewData.content);
    if (lengthRisk > 0) {
      fraudIndicators.push({
        type: 'unnatural_length',
        description: 'Review length seems unnatural',
        score: lengthRisk
      });
      riskScore += lengthRisk;
    }

    return {
      riskScore: Math.min(riskScore, 100),
      riskLevel: this.getRiskLevel(riskScore),
      indicators: fraudIndicators,
      recommendation: this.getRecommendation(riskScore)
    };
  }

  /**
   * Check account age risk
   */
  checkAccountAge(createdAt) {
    if (!createdAt) return 0;

    const accountAge = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    
    if (accountAge < this.thresholds.maxAccountAgeDays) {
      return 30; // High risk for accounts less than 1 day old
    } else if (accountAge < 7) {
      return 15; // Medium risk for accounts less than 7 days old
    }
    
    return 0;
  }

  /**
   * Check rating frequency
   */
  checkRatingFrequency(userId, timestamp) {
    const userRatings = this.recentActivities.get(`ratings_${userId}`) || [];
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);
    
    const recentRatings = userRatings.filter(rating => 
      new Date(rating.timestamp) > oneHourAgo
    );

    if (recentRatings.length >= this.thresholds.maxRatingsPerHour) {
      return 40; // High risk
    } else if (recentRatings.length >= this.thresholds.maxRatingsPerHour * 0.7) {
      return 20; // Medium risk
    }

    return 0;
  }

  /**
   * Check perfect score pattern
   */
  checkPerfectScorePattern(userId, stars) {
    const userRatings = this.recentActivities.get(`ratings_${userId}`) || [];
    
    if (userRatings.length < 5) return 0; // Not enough data

    const perfectScores = userRatings.filter(rating => rating.stars === 5);
    const perfectScoreRatio = perfectScores.length / userRatings.length;

    if (perfectScoreRatio > 0.9 && stars === 5) {
      return 25; // High risk
    } else if (perfectScoreRatio > 0.8) {
      return 15; // Medium risk
    }

    return 0;
  }

  /**
   * Check for reciprocal ratings
   */
  checkReciprocalRating(raterId, rateeId) {
    const userRatings = this.recentActivities.get(`ratings_${rateeId}`) || [];
    
    const reciprocalRating = userRatings.find(rating => 
      rating.rateeId === raterId && rating.stars >= 4
    );

    if (reciprocalRating) {
      return 35; // High risk for reciprocal high ratings
    }

    return 0;
  }

  /**
   * Check IP risk
   */
  async checkIPRisk(ip) {
    const ipRisk = this.ipRiskScores.get(ip) || 0;
    
    // Check if IP is in known proxy/VPN ranges (mock implementation)
    const isProxyVPN = await this.isProxyOrVPN(ip);
    if (isProxyVPN) {
      return 20;
    }

    return ipRisk;
  }

  /**
   * Check device risk
   */
  checkDeviceRisk(deviceFingerprint) {
    const deviceRisk = this.deviceRiskScores.get(deviceFingerprint) || 0;
    
    // Check if device is associated with multiple accounts
    const deviceAccounts = this.getAccountsByDevice(deviceFingerprint);
    if (deviceAccounts.length > 3) {
      return 25; // High risk
    } else if (deviceAccounts.length > 1) {
      return 10; // Medium risk
    }

    return deviceRisk;
  }

  /**
   * Check for duplicate content
   */
  checkDuplicateContent(content, userId) {
    const userReviews = this.recentActivities.get(`reviews_${userId}`) || [];
    
    for (const review of userReviews) {
      const similarity = this.calculateTextSimilarity(content, review.content);
      if (similarity > 0.8) {
        return 40; // High risk
      } else if (similarity > 0.6) {
        return 20; // Medium risk
      }
    }

    return 0;
  }

  /**
   * Check for spam keywords
   */
  checkSpamKeywords(content) {
    const spamKeywords = [
      'click here', 'free money', 'guaranteed', 'limited time',
      'act now', 'special offer', 'winner', 'congratulations',
      'viagra', 'casino', 'lottery', 'make money fast'
    ];

    const contentLower = content.toLowerCase();
    let matchCount = 0;

    for (const keyword of spamKeywords) {
      if (contentLower.includes(keyword)) {
        matchCount++;
      }
    }

    if (matchCount >= 3) {
      return 35; // High risk
    } else if (matchCount >= 1) {
      return 15; // Medium risk
    }

    return 0;
  }

  /**
   * Check language patterns
   */
  checkLanguagePatterns(content) {
    const patterns = {
      excessiveExclamation: /!{3,}/,
      excessiveCaps: /[A-Z]{4,}/,
      repetitiveChars: /(.)\1{3,}/,
      suspiciousEmojis: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]{5,}/u
    };

    let patternScore = 0;
    for (const [name, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        patternScore += 10;
      }
    }

    return Math.min(patternScore, 30);
  }

  /**
   * Check review frequency
   */
  checkReviewFrequency(userId, timestamp) {
    const userReviews = this.recentActivities.get(`reviews_${userId}`) || [];
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);
    
    const recentReviews = userReviews.filter(review => 
      new Date(review.timestamp) > oneHourAgo
    );

    if (recentReviews.length >= this.thresholds.maxReviewsPerHour) {
      return 35; // High risk
    } else if (recentReviews.length >= this.thresholds.maxReviewsPerHour * 0.7) {
      return 20; // Medium risk
    }

    return 0;
  }

  /**
   * Check review length patterns
   */
  checkReviewLengthPatterns(content) {
    const length = content.length;
    
    // Very short reviews might be spam
    if (length < 10) {
      return 20;
    }
    
    // Very long reviews with no substance might be generated
    if (length > 1000) {
      const wordCount = content.split(/\s+/).length;
      const avgWordLength = length / wordCount;
      
      if (avgWordLength > 8) { // Unusually long words
        return 15;
      }
    }

    return 0;
  }

  /**
   * Calculate text similarity (simplified)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Check if IP is proxy or VPN (mock implementation)
   */
  async isProxyOrVPN(ip) {
    // In production, use a real IP intelligence service
    const proxyRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
    
    // Mock implementation
    return false;
  }

  /**
   * Get accounts by device
   */
  getAccountsByDevice(deviceFingerprint) {
    // In production, query database
    return []; // Mock implementation
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(score) {
    if (score >= this.thresholds.highRiskScore) {
      return 'high';
    } else if (score >= this.thresholds.mediumRiskScore) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get recommendation based on risk score
   */
  getRecommendation(score) {
    if (score >= this.thresholds.highRiskScore) {
      return 'block';
    } else if (score >= this.thresholds.mediumRiskScore) {
      return 'review';
    } else {
      return 'allow';
    }
  }

  /**
   * Record activity for pattern analysis
   */
  recordActivity(type, userId, activityData) {
    const key = `${type}_${userId}`;
    
    if (!this.recentActivities.has(key)) {
      this.recentActivities.set(key, []);
    }

    const activities = this.recentActivities.get(key);
    activities.push({
      ...activityData,
      timestamp: new Date()
    });

    // Keep only last 100 activities per user
    if (activities.length > 100) {
      activities.shift();
    }
  }

  /**
   * Update user risk score
   */
  updateUserRiskScore(userId, riskScore) {
    const currentScore = this.userRiskScores.get(userId) || 0;
    const newScore = Math.max(currentScore, riskScore);
    this.userRiskScores.set(userId, newScore);
  }

  /**
   * Get user risk score
   */
  getUserRiskScore(userId) {
    return this.userRiskScores.get(userId) || 0;
  }

  /**
   * Flag suspicious activity
   */
  flagSuspiciousActivity(activity) {
    console.warn(`🚨 Suspicious activity detected:`, activity);
    
    // In production, send to security team
    // Create audit log
    // Possibly block user temporarily
  }

  /**
   * Generate fraud report
   */
  generateFraudReport(userId, timeRange = '24h') {
    const userActivities = {
      ratings: this.recentActivities.get(`ratings_${userId}`) || [],
      reviews: this.recentActivities.get(`reviews_${userId}`) || []
    };

    const report = {
      userId,
      riskScore: this.getUserRiskScore(userId),
      generatedAt: new Date().toISOString(),
      timeRange,
      activities: {
        totalRatings: userActivities.ratings.length,
        totalReviews: userActivities.reviews.length,
        suspiciousPatterns: []
      },
      recommendations: []
    };

    // Analyze patterns
    for (const [patternName, pattern] of this.suspiciousPatterns.entries()) {
      if (this.detectPattern(userId, patternName)) {
        report.activities.suspiciousPatterns.push({
          name: patternName,
          description: pattern.description,
          weight: pattern.weight
        });
      }
    }

    // Generate recommendations
    if (report.riskScore >= this.thresholds.highRiskScore) {
      report.recommendations.push('Consider temporary account suspension');
      report.recommendations.push('Manual review required');
    } else if (report.riskScore >= this.thresholds.mediumRiskScore) {
      report.recommendations.push('Increase monitoring');
      report.recommendations.push('Require additional verification');
    }

    return report;
  }

  /**
   * Detect specific pattern
   */
  detectPattern(userId, patternName) {
    // Implementation would depend on the specific pattern
    // This is a placeholder for pattern detection logic
    return false;
  }
}

export default new FraudDetectionService();
