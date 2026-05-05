import { useState } from 'react'
import { useReviewsList } from '../../api/reviews'
import ReviewCard from './ReviewCard'

function ReviewsList({ targetType, targetId }) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('newest')
  const limit = 10

  const { data, isLoading, error, refetch } = useReviewsList({
    targetType,
    targetId,
    page,
    limit,
    sort,
  })

  const reviews = data?.reviews || []
  const totalPages = data?.totalPages || 1
  const totalCount = data?.totalCount || 0

  const handleSortChange = (e) => {
    setSort(e.target.value)
    setPage(1)
  }

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1)
    }
  }

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="h-20 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 mb-4">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No reviews yet. Be the first to review!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Reviews ({totalCount})
        </h2>
        <select
          value={sort}
          onChange={handleSortChange}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Rated</option>
          <option value="lowest">Lowest Rated</option>
        </select>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id ?? review._id} review={review} targetType={targetType} targetId={targetId} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex space-x-2">
            <button
              onClick={handlePreviousPage}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewsList
