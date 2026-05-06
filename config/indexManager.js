/**
 * Database Index Manager for Performance Optimization
 */
import mongoose from 'mongoose';

class IndexManager {
  static async setupPerformanceIndexes() {
    try {
      console.log('🔧 Setting up performance indexes...');
      
      // Rating collection indexes
      await this.setupRatingIndexes();
      
      // Review collection indexes  
      await this.setupReviewIndexes();
      
      // TrustScore collection indexes
      await this.setupTrustScoreIndexes();
      
      // User collection indexes
      await this.setupUserIndexes();
      
      console.log('✅ Performance indexes created successfully');
    } catch (error) {
      console.error('❌ Error setting up indexes:', error);
      throw error;
    }
  }

  static async setupRatingIndexes() {
    const Rating = mongoose.model('Rating');
    
    // Compound indexes for common queries
    await Rating.collection.createIndexes([
      // User ratings with status and time
      { key: { rateeId: 1, status: 1, createdAt: -1 } },
      
      // Rater history with time
      { key: { raterId: 1, status: 1, createdAt: -1 } },
      
      // Context-based queries
      { key: { context: 1, status: 1, createdAt: -1 } },
      
      // Rating distribution queries
      { key: { stars: 1, status: 1 } },
      
      // Transaction-based queries
      { key: { contextId: 1, status: 1 } },
      
      // Pinned ratings
      { key: { isPinned: 1, createdAt: -1 } },
      
      // Report monitoring
      { key: { reportCount: -1, status: 1 } },
      
      // Recent ratings
      { key: { createdAt: -1 } },
      
      // Duplicate prevention (unique)
      { 
        key: { raterId: 1, rateeId: 1, context: 1, contextId: 1 }, 
        unique: true, 
        sparse: true,
        name: 'unique_rating_prevention'
      }
    ]);
    
    console.log('✅ Rating indexes created');
  }

  static async setupReviewIndexes() {
    const Review = mongoose.model('Review');
    
    await Review.collection.createIndexes([
      // User reviews with status and time
      { key: { rateeId: 1, status: 1, createdAt: -1 } },
      
      // Rater review history
      { key: { raterId: 1, status: 1, createdAt: -1 } },
      
      // Rating relationship
      { key: { ratingId: 1 } },
      
      // Helpful/unhelpful sorting
      { key: { helpfulCount: -1, notHelpfulCount: 1 } },
      
      // Report monitoring
      { key: { reportCount: -1, status: 1 } },
      
      // Tag-based queries
      { key: { tags: 1 } },
      
      // Recent reviews
      { key: { createdAt: -1 } },
      
      // Context-based filtering
      { key: { context: 1, status: 1 } }
    ]);
    
    console.log('✅ Review indexes created');
  }

  static async setupTrustScoreIndexes() {
    const TrustScore = mongoose.model('TrustScore');
    
    await TrustScore.collection.createIndexes([
      // Leaderboard queries
      { key: { score: -1 } },
      
      // Badge-based queries
      { key: { badge: 1 } },
      
      // Recent updates
      { key: { lastUpdated: -1 } },
      
      // High-rated users
      { key: { 'metrics.totalRatingsReceived': -1 } },
      
      // Verification status
      { key: { 'metrics.verificationStatus': 1 } },
      
      // User lookup
      { key: { userId: 1 }, unique: true },
      
      // Score ranges for filtering
      { key: { score: 1, badge: 1 } }
    ]);
    
    console.log('✅ TrustScore indexes created');
  }

  static async setupUserIndexes() {
    const User = mongoose.model('User');
    
    await User.collection.createIndexes([
      // Email lookup (unique)
      { key: { email: 1 }, unique: true },
      
      // Username lookup (unique)
      { key: { username: 1 }, unique: true },
      
      // Status-based queries
      { key: { status: 1, createdAt: -1 } },
      
      // Verification status
      { key: { 'profile.verificationStatus': 1 } },
      
      // Role-based queries
      { key: { role: 1 } },
      
      // Recent users
      { key: { createdAt: -1 } },
      
      // Search functionality
      { key: { 'profile.displayName': 'text', username: 'text' } }
    ]);
    
    console.log('✅ User indexes created');
  }

  static async setupAggregationPipelines() {
    try {
      console.log('🔧 Setting up aggregation views...');
      
      // Rating summary view
      await this.createRatingSummaryView();
      
      // Trust score statistics view
      await this.createTrustStatsView();
      
      // Activity monitoring view
      await this.createActivityView();
      
      console.log('✅ Aggregation views created');
    } catch (error) {
      console.error('❌ Error creating views:', error);
      throw error;
    }
  }

  static async createRatingSummaryView() {
    const Rating = mongoose.model('Rating');
    
    // Create aggregation pipeline for rating summaries
    const ratingSummaryPipeline = [
      {
        $match: {
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$rateeId',
          totalRatings: { $sum: 1 },
          averageRating: { $avg: '$stars' },
          ratingDistribution: {
            $push: '$stars'
          },
          lastRatingDate: { $max: '$createdAt' },
          contexts: { $addToSet: '$context' }
        }
      },
      {
        $addFields: {
          fiveStarCount: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 5] }
              }
            }
          },
          fourStarCount: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 4] }
              }
            }
          },
          threeStarCount: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 3] }
              }
            }
          },
          twoStarCount: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 2] }
              }
            }
          },
          oneStarCount: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 1] }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          totalRatings: 1,
          averageRating: { $round: ['$averageRating', 2] },
          lastRatingDate: 1,
          contexts: 1,
          distribution: {
            5: '$fiveStarCount',
            4: '$fourStarCount', 
            3: '$threeStarCount',
            2: '$twoStarCount',
            1: '$oneStarCount'
          }
        }
      }
    ];
    
    // Store pipeline for reuse
    this.ratingSummaryPipeline = ratingSummaryPipeline;
    console.log('✅ Rating summary pipeline created');
  }

  static async createTrustStatsView() {
    const TrustScore = mongoose.model('TrustScore');
    
    const trustStatsPipeline = [
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          averageScore: { $avg: '$score' },
          badgeDistribution: {
            $push: '$badge'
          },
          verifiedUsers: {
            $sum: {
              $cond: [
                { $ne: ['$metrics.verificationStatus', 'unverified'] },
                1,
                0
              ]
            }
          },
          highTrustUsers: {
            $sum: {
              $cond: [
                { $gte: ['$score', 80] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          badgeCounts: {
            $reduce: {
              input: '$badgeDistribution',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [{ k: '$$this', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }]
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalUsers: 1,
          averageScore: { $round: ['$averageScore', 2] },
          verifiedUsers: 1,
          highTrustUsers: 1,
          badgeCounts: 1,
          verificationRate: {
            $round: [
              { $multiply: [{ $divide: ['$verifiedUsers', '$totalUsers'] }, 100] },
              2
            ]
          },
          highTrustRate: {
            $round: [
              { $multiply: [{ $divide: ['$highTrustUsers', '$totalUsers'] }, 100] },
              2
            ]
          }
        }
      }
    ];
    
    this.trustStatsPipeline = trustStatsPipeline;
    console.log('✅ Trust stats pipeline created');
  }

  static async createActivityView() {
    const Rating = mongoose.model('Rating');
    const Review = mongoose.model('Review');
    
    // Recent activity pipeline
    const activityPipeline = [
      {
        $facet: {
          recentRatings: [
            {
              $match: {
                status: 'active',
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
              }
            },
            {
              $sort: { createdAt: -1 }
            },
            {
              $limit: 10
            },
            {
              $project: {
                type: 'rating',
                userId: '$rateeId',
                actorId: '$raterId',
                value: '$stars',
                context: '$context',
                createdAt: 1
              }
            }
          ],
          recentReviews: [
            {
              $match: {
                status: 'published',
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
              }
            },
            {
              $sort: { createdAt: -1 }
            },
            {
              $limit: 10
            },
            {
              $project: {
                type: 'review',
                userId: '$rateeId',
                actorId: '$raterId',
                content: { $substr: ['$content', 0, 100] },
                context: '$context',
                createdAt: 1
              }
            }
          ]
        }
      },
      {
        $project: {
          activities: {
            $concatArrays: ['$recentRatings', '$recentReviews']
          }
        }
      },
      {
        $unwind: '$activities'
      },
      {
        $sort: { 'activities.createdAt': -1 }
      },
      {
        $limit: 20
      },
      {
        $replaceRoot: { newRoot: '$activities' }
      }
    ];
    
    this.activityPipeline = activityPipeline;
    console.log('✅ Activity pipeline created');
  }

  static async analyzeIndexUsage() {
    try {
      console.log('📊 Analyzing index usage...');
      
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      
      for (const collection of collections) {
        const stats = await db.collection(collection.name).aggregate([
          { $indexStats: {} }
        ]).toArray();
        
        console.log(`\n📈 ${collection.name} Index Usage:`);
        stats.forEach(stat => {
          console.log(`  - ${stat.name}: ${stat.accesses.ops} operations`);
        });
      }
    } catch (error) {
      console.error('❌ Error analyzing index usage:', error);
    }
  }

  static async optimizeIndexes() {
    try {
      console.log('🔧 Optimizing indexes...');
      
      // Analyze slow queries
      await this.analyzeSlowQueries();
      
      // Check index usage
      await this.analyzeIndexUsage();
      
      // Suggest optimizations
      await this.suggestOptimizations();
      
      console.log('✅ Index optimization completed');
    } catch (error) {
      console.error('❌ Error optimizing indexes:', error);
    }
  }

  static async analyzeSlowQueries() {
    try {
      const db = mongoose.connection.db;
      
      // Get slow query logs (MongoDB 5.0+)
      const slowQueries = await db.collection('system.profile').find({
        millis: { $gt: 100 }
      }).sort({ ts: -1 }).limit(10).toArray();
      
      if (slowQueries.length > 0) {
        console.log('\n🐌 Slow Queries Found:');
        slowQueries.forEach(query => {
          console.log(`  - ${query.command} took ${query.millis}ms`);
          console.log(`    Collection: ${query.ns}`);
        });
      }
    } catch (error) {
      console.log('⚠️  Slow query analysis not available');
    }
  }

  static async suggestOptimizations() {
    console.log('\n💡 Optimization Suggestions:');
    console.log('  1. Monitor query performance regularly');
    console.log('  2. Consider adding compound indexes for frequent multi-field queries');
    console.log('  3. Use partial indexes for sparse data');
    console.log('  4. Implement read preferences for scaling');
    console.log('  5. Consider sharding for large datasets');
  }
}

export default IndexManager;
