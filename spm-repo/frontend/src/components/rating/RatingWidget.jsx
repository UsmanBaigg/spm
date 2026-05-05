import { useState } from 'react'

function RatingWidget({ value = 0, onChange, readOnly = false }) {
  const [hoverValue, setHoverValue] = useState(0)

  const handleMouseEnter = (rating) => {
    if (!readOnly) {
      setHoverValue(rating)
    }
  }

  const handleMouseLeave = () => {
    setHoverValue(0)
  }

  const handleClick = (rating) => {
    if (!readOnly && onChange) {
      onChange(rating)
    }
  }

  const handleKeyDown = (e, rating) => {
    if (readOnly) return

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        const nextRating = Math.min(5, (hoverValue || value) + 1)
        setHoverValue(nextRating)
        onChange?.(nextRating)
        break
      case 'ArrowLeft':
        e.preventDefault()
        const prevRating = Math.max(1, (hoverValue || value) - 1)
        setHoverValue(prevRating)
        onChange?.(prevRating)
        break
      case 'Home':
        e.preventDefault()
        setHoverValue(1)
        onChange?.(1)
        break
      case 'End':
        e.preventDefault()
        setHoverValue(5)
        onChange?.(5)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onChange?.(rating)
        break
      default:
        break
    }
  }

  const displayValue = hoverValue || value

  return (
    <div
      className="inline-flex items-center"
      role="radiogroup"
      aria-label={`Rating: ${displayValue} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => handleClick(rating)}
          onMouseEnter={() => handleMouseEnter(rating)}
          onMouseLeave={handleMouseLeave}
          onKeyDown={(e) => handleKeyDown(e, rating)}
          disabled={readOnly}
          className={`w-8 h-8 mr-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors ${
            readOnly ? 'cursor-default' : 'cursor-pointer'
          }`}
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} star${rating !== 1 ? 's' : ''}`}
          tabIndex={readOnly ? -1 : 0}
        >
          <svg
            className={`w-full h-full ${
              rating <= displayValue ? 'text-yellow-400' : 'text-gray-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export default RatingWidget
