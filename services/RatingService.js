import { supabase } from '../config/supabase.js';
import TrustScoreService from './TrustScoreService.js';

class RatingService {
  static _mapToCamelCase(record) {
    if (!record) return null;
    return {
      _id: record.id,
      id: record.id,
      raterId: record.rater_id,
      rateeId: record.ratee_id,
      stars: record.stars,
      context: record.context,
      contextId: record.context_id,
      reviewId: record.review_id,
      raterInfo: record.rater_info,
      isAnonymous: record.is_anonymous,
      status: record.status,
      reportCount: record.report_count,
      isPinned: record.is_pinned,
      editHistory: record.edit_history,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  static _isEditableNow(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    return hoursDiff < 24;
  }

  /**
   * Submit a new rating
   */
  static async submitRating(raterId, rateeId, stars, context = 'general', contextId = null, raterInfo = {}) {
    try {
      // Check for duplicate rating in same context
      let query = supabase
        .from('ratings')
        .select('id')
        .eq('rater_id', raterId)
        .eq('ratee_id', rateeId)
        .eq('context', context)
        .neq('status', 'deleted');

      if (contextId) {
        query = query.eq('context_id', contextId);
      }

      const { data: existingRating } = await query;

      if (existingRating && existingRating.length > 0) {
        throw new Error('Duplicate rating: You have already rated this user in this context');
      }

      // Create new rating
      const { data: savedRating, error: insertError } = await supabase
        .from('ratings')
        .insert([{
          rater_id: raterId,
          ratee_id: rateeId,
          stars,
          context,
          context_id: contextId,
          rater_info: {
            username: raterInfo.username || 'Anonymous User',
            profileImage: raterInfo.profileImage || null,
            badge: raterInfo.badge || null,
          }
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Recalculate trust score for ratee
      await TrustScoreService.recalculateTrustScore(rateeId);

      return this._mapToCamelCase(savedRating);
    } catch (error) {
      throw new Error(`Failed to submit rating: ${error.message}`);
    }
  }

  /**
   * Edit a rating (within 24 hours)
   */
  static async editRating(ratingId, raterId, newStars, reviewText = null) {
    try {
      const { data: rating, error: fetchError } = await supabase
        .from('ratings')
        .select('*')
        .eq('id', ratingId)
        .single();

      if (fetchError || !rating) throw new Error('Rating not found');
      if (rating.rater_id !== raterId) throw new Error('Unauthorized: You can only edit your own ratings');
      if (!this._isEditableNow(rating.created_at)) throw new Error('Rating can only be edited within 24 hours of creation');

      const newHistoryEntry = {
        stars: rating.stars,
        editedAt: new Date().toISOString()
      };
      const editHistory = rating.edit_history || [];
      editHistory.push(newHistoryEntry);

      const { data: updatedRating, error: updateError } = await supabase
        .from('ratings')
        .update({
          stars: newStars,
          status: 'edited',
          edit_history: editHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', ratingId)
        .select()
        .single();

      if (updateError) throw updateError;

      await TrustScoreService.recalculateTrustScore(rating.ratee_id);
      return this._mapToCamelCase(updatedRating);
    } catch (error) {
      throw new Error(`Failed to edit rating: ${error.message}`);
    }
  }

  /**
   * Delete a rating (within 24 hours)
   */
  static async deleteRating(ratingId, raterId) {
    try {
      const { data: rating, error: fetchError } = await supabase
        .from('ratings')
        .select('*')
        .eq('id', ratingId)
        .single();

      if (fetchError || !rating) throw new Error('Rating not found');
      if (rating.rater_id !== raterId) throw new Error('Unauthorized: You can only delete your own ratings');
      if (!this._isEditableNow(rating.created_at)) throw new Error('Rating can only be deleted within 24 hours of creation');

      const { error: updateError } = await supabase
        .from('ratings')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', ratingId);

      if (updateError) throw updateError;

      await TrustScoreService.recalculateTrustScore(rating.ratee_id);
      return { success: true, message: 'Rating deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete rating: ${error.message}`);
    }
  }

  /**
   * Get ratings received by a user
   */
  static async getRatingsForUser(userId, page = 1, limit = 10, context = null) {
    try {
      let query = supabase
        .from('ratings')
        .select('*', { count: 'exact' })
        .eq('ratee_id', userId)
        .neq('status', 'deleted');

      if (context) query = query.eq('context', context);

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: ratings, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        ratings: ratings.map(r => this._mapToCamelCase(r)),
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) }
      };
    } catch (error) {
      throw new Error(`Failed to get ratings: ${error.message}`);
    }
  }

  /**
   * Get ratings given by a user
   */
  static async getRatingsGivenByUser(userId, page = 1, limit = 10) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: ratings, count, error } = await supabase
        .from('ratings')
        .select('*', { count: 'exact' })
        .eq('rater_id', userId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        ratings: ratings.map(r => this._mapToCamelCase(r)),
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) }
      };
    } catch (error) {
      throw new Error(`Failed to get given ratings: ${error.message}`);
    }
  }

  /**
   * Get rating statistics for a user
   */
  static async getRatingStats(userId, context = null) {
    try {
      let query = supabase
        .from('ratings')
        .select('*')
        .eq('ratee_id', userId)
        .neq('status', 'deleted');

      if (context) query = query.eq('context', context);

      const { data: ratings, error } = await query;
      if (error) throw error;

      if (!ratings || ratings.length === 0) {
        return {
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          recentRatings: []
        };
      }

      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalStars = 0;

      ratings.forEach(rating => {
        distribution[rating.stars] += 1;
        totalStars += rating.stars;
      });

      const averageRating = (totalStars / ratings.length).toFixed(2);
      const recentRatings = ratings
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(r => this._mapToCamelCase(r));

      return {
        totalRatings: ratings.length,
        averageRating: parseFloat(averageRating),
        ratingDistribution: distribution,
        recentRatings
      };
    } catch (error) {
      throw new Error(`Failed to get rating stats: ${error.message}`);
    }
  }

  /**
   * Report a rating
   */
  static async reportRating(ratingId, reason) {
    try {
      const { data: rating, error: fetchError } = await supabase
        .from('ratings')
        .select('*')
        .eq('id', ratingId)
        .single();

      if (fetchError || !rating) throw new Error('Rating not found');

      const reportCount = (rating.report_count || 0) + 1;
      const status = reportCount >= 3 ? 'flagged' : rating.status;

      const { data: updated, error: updateError } = await supabase
        .from('ratings')
        .update({ report_count: reportCount, status })
        .eq('id', ratingId)
        .select()
        .single();

      if (updateError) throw updateError;
      return this._mapToCamelCase(updated);
    } catch (error) {
      throw new Error(`Failed to report rating: ${error.message}`);
    }
  }

  /**
   * Get seller ratings (marketplace context)
   */
  static async getSellerRatings(userId) {
    try {
      return this.getRatingStats(userId, 'marketplace');
    } catch (error) {
      throw new Error(`Failed to get seller ratings: ${error.message}`);
    }
  }

  /**
   * Get service provider ratings (services context)
   */
  static async getServiceProviderRatings(userId) {
    try {
      return this.getRatingStats(userId, 'services');
    } catch (error) {
      throw new Error(`Failed to get service provider ratings: ${error.message}`);
    }
  }

  /**
   * Pin a rating (admin only)
   */
  static async pinRating(ratingId, adminId) {
    try {
      const { data, error } = await supabase.from('ratings').update({ is_pinned: true }).eq('id', ratingId).select().single();
      if (error || !data) throw new Error('Rating not found');
      return this._mapToCamelCase(data);
    } catch (error) {
      throw new Error(`Failed to pin rating: ${error.message}`);
    }
  }

  /**
   * Unpin a rating (admin only)
   */
  static async unpinRating(ratingId) {
    try {
      const { data, error } = await supabase.from('ratings').update({ is_pinned: false }).eq('id', ratingId).select().single();
      if (error || !data) throw new Error('Rating not found');
      return this._mapToCamelCase(data);
    } catch (error) {
      throw new Error(`Failed to unpin rating: ${error.message}`);
    }
  }
}

export default RatingService;
