import { useRatingSummary } from '../../api/ratings'

function RatingSummaryCard({ targetType, targetId }) {
  const { data, isLoading, error } = useRatingSummary(targetType, targetId)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-gray-300 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-6"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">{error.message}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-500">No ratings yet</p>
      </div>
    )
  }

  const { averageRating, totalReviews, distribution } = data

  const getPercentage = (count) => {
    if (totalReviews === 0) return 0
    return Math.round((count / totalReviews) * 100)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Rating Summary</h2>
      
      <div className="flex items-center mb-6">
        <div className="text-5xl font-bold text-gray-900 mr-4">
          {averageRating.toFixed(1)}
        </div>
        <div>
          <div className="flex items-center mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-6 h-6 ${
                  star <= Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-300'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-sm text-gray-500">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {totalReviews > 0 && distribution && (
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] || 0
            const percentage = getPercentage(count)
            return (
              <div key={star} className="flex items-center">
                <span className="w-12 text-sm text-gray-600">{star} star</span>
                <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="w-12 text-sm text-gray-600 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RatingSummaryCard
