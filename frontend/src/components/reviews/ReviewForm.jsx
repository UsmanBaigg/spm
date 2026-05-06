import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import RatingWidget from '../rating/RatingWidget'
import { useCreateReview, useUpdateReview } from '../../api/reviews'

const reviewSchema = z.object({
  rating: z.number().min(1, 'Rating is required').max(5, 'Rating must be between 1 and 5'),
  comment: z.string().max(800, 'Comment must be less than 800 characters').optional(),
})

function ReviewForm({
  mode = 'create',
  reviewId,
  initialRating = 0,
  initialComment = '',
  targetType,
  targetId,
  onSuccess,
  onCancel,
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: initialRating,
      comment: initialComment,
    },
  })

  const createReviewMutation = useCreateReview()
  const updateReviewMutation = useUpdateReview()

  const onSubmit = async (data) => {
    try {
      if (mode === 'edit') {
        await updateReviewMutation.mutateAsync({
          id: reviewId,
          payload: { ...data, targetType, targetId },
        })
      } else {
        await createReviewMutation.mutateAsync({
          targetType,
          targetId,
          ...data,
        })
        reset()
      }
      onSuccess?.()
    } catch (error) {
      console.error('Failed to create review:', error)
    }
  }

  return (
    <div className="card p-6">
      <div className="card-header mb-4">
        <div>
          <h2 className="card-title">{mode === 'edit' ? 'Edit Review' : 'Write a Review'}</h2>
          <p className="card-subtitle">Share your experience to help the community.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating <span className="text-red-500">*</span>
          </label>
          <RatingWidget
            value={watch('rating')}
            onChange={(value) => setValue('rating', value)}
          />
          {errors.rating && (
            <p className="mt-1 text-sm text-red-600">{errors.rating.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
            Comment
          </label>
          <textarea
            id="comment"
            {...register('comment')}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Share your experience..."
          />
          <div className="flex justify-between mt-1">
            {errors.comment && (
              <p className="text-sm text-red-600">{errors.comment.message}</p>
            )}
            <p className="text-sm text-gray-500 ml-auto">
              {watch('comment')?.length || 0}/800
            </p>
          </div>
        </div>

        {(createReviewMutation.error || updateReviewMutation.error) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              {(createReviewMutation.error || updateReviewMutation.error).message}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {mode === 'edit' ? (
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
              Cancel
            </button>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || createReviewMutation.isPending || updateReviewMutation.isPending}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSubmitting || createReviewMutation.isPending || updateReviewMutation.isPending
              ? 'Submitting...'
              : mode === 'edit'
                ? 'Save Changes'
                : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ReviewForm
