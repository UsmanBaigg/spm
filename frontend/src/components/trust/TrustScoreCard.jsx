import { useUserTrust } from '../../api/trust'

function getTrustLevel(score) {
  if (score >= 70) return { label: 'High', color: 'bg-green-500' }
  if (score >= 30) return { label: 'Medium', color: 'bg-yellow-500' }
  return { label: 'Low', color: 'bg-red-500' }
}

function TrustScoreCard({ userId }) {
  const { data, isLoading, error } = useUserTrust(userId)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-gray-300 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-600 font-medium">Failed to load trust score</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-500">Trust score not available</p>
      </div>
    )
  }

  const { reputationScore, isVerified } = data
  const trustLevel = getTrustLevel(reputationScore)

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow duration-300">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Trust Score</h2>
      
      <div className="flex items-center mb-4">
        <div className="text-5xl font-bold text-gray-900 mr-4">
          {reputationScore}
        </div>
        <div>
          <div className="flex items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${trustLevel.color}`}>
              {trustLevel.label} Trust
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Reputation Score</p>
        </div>
      </div>

      {isVerified && (
        <div className="flex items-center text-green-600">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Verified User</span>
        </div>
      )}
    </div>
  )
}

export default TrustScoreCard
