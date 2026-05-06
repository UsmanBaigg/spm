import { useParams } from 'react-router-dom'
import { useState } from 'react'
import RatingSummaryCard from '../components/rating/RatingSummaryCard'
import ReviewsList from '../components/reviews/ReviewsList'
import ReviewForm from '../components/reviews/ReviewForm'

function ServiceDetailPage() {
  const { id } = useParams()
  const [showReviewForm, setShowReviewForm] = useState(false)

  const handleReviewSuccess = () => {
    setShowReviewForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Service Detail</h1>
        <p className="text-sm text-slate-500">Ratings and reviews for this service.</p>
      </div>

      <RatingSummaryCard targetType="service" targetId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ReviewsList targetType="service" targetId={id} />
        </div>
        <div className="lg:col-span-1">
          {!showReviewForm ? (
            <button
              onClick={() => setShowReviewForm(true)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Write a Review
            </button>
          ) : (
            <ReviewForm
              targetType="service"
              targetId={id}
              onSuccess={handleReviewSuccess}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ServiceDetailPage
