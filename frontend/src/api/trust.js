import { isSupabaseConfigured, supabase } from './client'
import { useQuery } from '@tanstack/react-query'

export async function getUserTrust(userId) {
  if (!isSupabaseConfigured) {
    // Mock data for demo mode
    const mockTrustData = {
      '1': {
        reputationScore: 85,
        isVerified: true,
        badges: [
          { id: 'trusted-neighbor', name: 'Trusted Neighbor', description: 'Consistently reliable community member', icon: '🏠' },
          { id: 'verified-contributor', name: 'Verified Contributor', description: 'Identity verified by Bring', icon: '✅' },
          { id: 'helpful-reviewer', name: 'Helpful Reviewer', description: 'Writes detailed and helpful reviews', icon: '⭐' }
        ],
        metrics: {
          totalRatingsReceived: 15,
          averageRating: 4.2,
          accountAgeDays: 180,
          verificationStatus: 'verified',
          moderationIncidents: 0
        }
      },
      '2': {
        reputationScore: 72,
        isVerified: true,
        badges: [
          { id: 'community-member', name: 'Community Member', description: 'Active participant in the community', icon: '👥' },
          { id: 'verified-contributor', name: 'Verified Contributor', description: 'Identity verified by Bring', icon: '✅' }
        ],
        metrics: {
          totalRatingsReceived: 8,
          averageRating: 3.8,
          accountAgeDays: 120,
          verificationStatus: 'verified',
          moderationIncidents: 0
        }
      },
      '3': {
        reputationScore: 45,
        isVerified: false,
        badges: [
          { id: 'new-neighbor', name: 'New Neighbor', description: 'Recently joined the community', icon: '🆕' }
        ],
        metrics: {
          totalRatingsReceived: 3,
          averageRating: 3.5,
          accountAgeDays: 30,
          verificationStatus: 'pending',
          moderationIncidents: 0
        }
      }
    }
    
    return mockTrustData[userId] || {
      reputationScore: 0,
      isVerified: false,
      badges: [
        { id: 'new-neighbor', name: 'New Neighbor', description: 'Recently joined the community', icon: '🆕' }
      ],
      metrics: {
        totalRatingsReceived: 0,
        averageRating: 0,
        accountAgeDays: 0,
        verificationStatus: 'unverified',
        moderationIncidents: 0
      }
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
