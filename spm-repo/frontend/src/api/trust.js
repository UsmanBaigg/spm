import { isSupabaseConfigured, supabase } from './client'
import { useQuery } from '@tanstack/react-query'

export async function getUserTrust(userId) {
  if (!isSupabaseConfigured) {
    return {
      reputationScore: 0,
      isVerified: false,
      badges: [],
    }
  }

  const { data, error } = await supabase
    .from('user_trust')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        reputationScore: 0,
        isVerified: false,
        badges: [],
      }
    }
    throw error
  }

  return data || {
    reputationScore: 0,
    isVerified: false,
    badges: [],
  }
}

export function useUserTrust(userId) {
  return useQuery({
    queryKey: ['userTrust', userId],
    queryFn: () => getUserTrust(userId),
    enabled: !!userId,
  })
}
