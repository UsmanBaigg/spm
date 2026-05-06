import { useMemo, useState } from 'react'
import RatingWidget from '../rating/RatingWidget'
import { formatDate } from '../../utils/format'
import ReviewForm from './ReviewForm'
import { useDeleteReview } from '../../api/reviews'

function normalizeReviewer(review) {
  // Supabase tables often store either reviewer fields inline or nested.
  if (review?.reviewer?.name) return review.reviewer.name
  if (review?.reviewerName) return review.reviewerName
  if (review?.reviewer_name) return review.reviewer_name
  return 'Anonymous'
}

function normalizeCreatedAt(review) {
  return review?.createdAt || review?.created_at || review?.timestamp || null
}

function ReviewCard({ review, targetType, targetId }) {
  const deleteMutation = useDeleteReview()
  const [isEditing, setIsEditing] = useState(false)

  const reviewerName = useMemo(() => normalizeReviewer(review), [review])
  const createdAt = useMemo(() => normalizeCreatedAt(review), [review])
  const rating = review?.rating ?? 0
  const comment = review?.comment ?? ''
  const reviewId = review?.id ?? review?._id

  if (isEditing) {
    return (
      <ReviewForm
        mode="edit"
        reviewId={reviewId}
        initialRating={rating}
        initialComment={comment}
        targetType={targetType}
        targetId={targetId}
        onSuccess={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">{reviewerName}</h3>
          <p className="text-sm text-slate-500">{createdAt ? formatDate(createdAt) : '—'}</p>
        </div>
        <RatingWidget value={rating} readOnly />
      </div>

      {comment ? <p className="mt-3 text-slate-700">{comment}</p> : null}

      {reviewId ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate({ id: reviewId, targetType, targetId })}
            disabled={deleteMutation.isPending}
            className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ReviewCard
