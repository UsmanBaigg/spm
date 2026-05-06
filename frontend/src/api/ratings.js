import { isSupabaseConfigured, supabase } from './client'
import { useQuery } from '@tanstack/react-query'

export async function getRatingSummary({ targetType, targetId }) {
  if (!isSupabaseConfigured) {
    // Mock data for demo mode
    const mockData = {
      user: {
        '1': { averageRating: 4.2, totalReviews: 15, distribution: { 5: 8, 4: 4, 3: 2, 2: 1, 1: 0 } },
        '2': { averageRating: 3.8, totalReviews: 8, distribution: { 5: 3, 4: 2, 3: 2, 2: 1, 1: 0 } },
      },
      service: {
        '1': { averageRating: 4.6, totalReviews: 23, distribution: { 5: 15, 4: 5, 3: 2, 2: 1, 1: 0 } },
        '2': { averageRating: 4.1, totalReviews: 12, distribution: { 5: 6, 4: 3, 3: 2, 2: 1, 1: 0 } },
      },
      marketplace: {
        '1': { averageRating: 3.9, totalReviews: 18, distribution: { 5: 7, 4: 5, 3: 4, 2: 2, 1: 0 } },
        '2': { averageRating: 4.4, totalReviews: 25, distribution: { 5: 16, 4: 6, 3: 2, 2: 1, 1: 0 } },
      },
    }
    
    return mockData[targetType]?.[targetId] || {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    }
  }

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  if (error) throw error

  if (!reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    }
  }

  const totalReviews = reviews.length
  const sumRating = reviews.reduce((sum, r) => sum + r.rating, 0)
  const averageRating = sumRating / totalReviews

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  reviews.forEach((review) => {
    distribution[review.rating] = (distribution[review.rating] || 0) + 1
  })

  return {
    averageRating,
    totalReviews,
    distribution,
  }
}

export function useRatingSummary(targetType, targetId) {
  return useQuery({
    queryKey: ['ratingSummary', targetType, targetId],
    queryFn: () => getRatingSummary({ targetType, targetId }),
    enabled: !!targetType && !!targetId,
  })
}
