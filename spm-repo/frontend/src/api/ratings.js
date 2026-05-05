import { isSupabaseConfigured, supabase } from './client'
import { useQuery } from '@tanstack/react-query'

export async function getRatingSummary({ targetType, targetId }) {
  if (!isSupabaseConfigured) {
    return {
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
