import { isSupabaseConfigured, supabase } from './client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export async function listReviews({ targetType, targetId, page = 1, limit = 10, sort = 'newest' }) {
  if (!isSupabaseConfigured) {
    // Mock data for demo mode
    const mockReviews = {
      user: {
        '1': [
          {
            id: 1,
            rating: 5,
            comment: "Excellent user! Very responsive and professional. Great communication throughout the entire process.",
            created_at: "2026-03-15T10:30:00Z",
            reviewer_name: "Sarah Johnson",
            reviewer_avatar: "https://picsum.photos/seed/sarah/40/40.jpg"
          },
          {
            id: 2,
            rating: 4,
            comment: "Good experience overall. Would work with again. Minor delays but quality was good.",
            created_at: "2026-03-12T14:20:00Z",
            reviewer_name: "Mike Chen",
            reviewer_avatar: "https://picsum.photos/seed/mike/40/40.jpg"
          },
          {
            id: 3,
            rating: 5,
            comment: "Outstanding service! Exceeded my expectations. Highly recommended!",
            created_at: "2026-03-10T09:15:00Z",
            reviewer_name: "Emily Davis",
            reviewer_avatar: "https://picsum.photos/seed/emily/40/40.jpg"
          },
          {
            id: 4,
            rating: 3,
            comment: "Average experience. Communication could be better.",
            created_at: "2026-03-08T16:45:00Z",
            reviewer_name: "Robert Wilson",
            reviewer_avatar: "https://picsum.photos/seed/robert/40/40.jpg"
          },
          {
            id: 5,
            rating: 5,
            comment: "Perfect! Delivered on time and great quality. Will definitely use again.",
            created_at: "2026-03-05T11:30:00Z",
            reviewer_name: "Lisa Anderson",
            reviewer_avatar: "https://picsum.photos/seed/lisa/40/40.jpg"
          }
        ],
        '2': [
          {
            id: 6,
            rating: 4,
            comment: "Good work, met all requirements. Would recommend.",
            created_at: "2026-03-14T13:10:00Z",
            reviewer_name: "Tom Brown",
            reviewer_avatar: "https://picsum.photos/seed/tom/40/40.jpg"
          }
        ]
      },
      service: {
        '1': [
          {
            id: 7,
            rating: 5,
            comment: "Exceptional service! Very knowledgeable and professional.",
            created_at: "2026-03-16T08:20:00Z",
            reviewer_name: "Jennifer Lee",
            reviewer_avatar: "https://picsum.photos/seed/jennifer/40/40.jpg"
          },
          {
            id: 8,
            rating: 4,
            comment: "Very good service, delivered as promised.",
            created_at: "2026-03-13T15:30:00Z",
            reviewer_name: "David Martinez",
            reviewer_avatar: "https://picsum.photos/seed/david/40/40.jpg"
          }
        ]
      },
      marketplace: {
        '1': [
          {
            id: 9,
            rating: 4,
            comment: "Great product, exactly as described. Fast shipping!",
            created_at: "2026-03-17T12:00:00Z",
            reviewer_name: "Amanda White",
            reviewer_avatar: "https://picsum.photos/seed/amanda/40/40.jpg"
          },
          {
            id: 10,
            rating: 3,
            comment: "Product is okay, but shipping took longer than expected.",
            created_at: "2026-03-11T10:45:00Z",
            reviewer_name: "Chris Taylor",
            reviewer_avatar: "https://picsum.photos/seed/chris/40/40.jpg"
          }
        ]
      }
    }

    const reviews = mockReviews[targetType]?.[targetId] || []
    const totalCount = reviews.length
    const totalPages = Math.ceil(totalCount / limit)
    
    return {
      reviews,
      totalCount,
      totalPages
    }
  }

  let query = supabase
    .from('reviews')
    .select('*', { count: 'exact' })
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true })
  } else if (sort === 'highest') {
    query = query.order('rating', { ascending: false })
  } else if (sort === 'lowest') {
    query = query.order('rating', { ascending: true })
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await query.range(from, to)

  if (error) throw error

  return {
    reviews: data || [],
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  }
}

export async function createReview(payload) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and restart the dev server.')
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert([{
      target_type: payload.targetType,
      target_id: payload.targetId,
      rating: payload.rating,
      comment: payload.comment,
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateReview(id, payload) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and restart the dev server.')
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({
      rating: payload.rating,
      comment: payload.comment,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteReview(id) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and restart the dev server.')
  }

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export function useReviewsList({ targetType, targetId, page = 1, limit = 10, sort = 'newest' }) {
  return useQuery({
    queryKey: ['reviews', targetType, targetId, page, sort],
    queryFn: () => listReviews({ targetType, targetId, page, limit, sort }),
    enabled: !!targetType && !!targetId,
  })
}

export function useCreateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createReview,
    onSuccess: (data, variables) => {
      // Invalidate all paginated/sorted review queries for this target
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey
          return key?.[0] === 'reviews' && key?.[1] === variables.targetType && key?.[2] === variables.targetId
        },
      })
      queryClient.invalidateQueries({ queryKey: ['ratingSummary', variables.targetType, variables.targetId] })
    },
  })
}

export function useUpdateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateReview(id, payload),
    onSuccess: (_data, variables) => {
      // Refresh all review queries; if caller supplies target, also refresh summary precisely
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      if (variables?.payload?.targetType && variables?.payload?.targetId) {
        queryClient.invalidateQueries({ queryKey: ['ratingSummary', variables.payload.targetType, variables.payload.targetId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['ratingSummary'] })
      }
    },
  })
}

export function useDeleteReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteReview,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      // If caller passes { targetType, targetId } alongside id, refresh summary precisely
      if (variables?.targetType && variables?.targetId) {
        queryClient.invalidateQueries({ queryKey: ['ratingSummary', variables.targetType, variables.targetId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['ratingSummary'] })
      }
    },
  })
}
