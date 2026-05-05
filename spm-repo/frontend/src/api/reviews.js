import { isSupabaseConfigured, supabase } from './client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export async function listReviews({ targetType, targetId, page = 1, limit = 10, sort = 'newest' }) {
  if (!isSupabaseConfigured) {
    return { reviews: [], totalCount: 0, totalPages: 1 }
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
