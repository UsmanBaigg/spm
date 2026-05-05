import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RatingWidget from './RatingWidget'

describe('RatingWidget', () => {
  it('renders 5 stars', () => {
    render(<RatingWidget value={0} onChange={() => {}} />)
    const buttons = screen.getAllByRole('radio')
    expect(buttons).toHaveLength(5)
  })

  it('displays the correct value', () => {
    render(<RatingWidget value={3} onChange={() => {}} />)
    const buttons = screen.getAllByRole('radio')
    expect(buttons[0]).toHaveAttribute('aria-checked', 'false')
    expect(buttons[1]).toHaveAttribute('aria-checked', 'false')
    expect(buttons[2]).toHaveAttribute('aria-checked', 'true')
    expect(buttons[3]).toHaveAttribute('aria-checked', 'false')
    expect(buttons[4]).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when a star is clicked', () => {
    const handleChange = vi.fn()
    render(<RatingWidget value={0} onChange={handleChange} />)
    
    const buttons = screen.getAllByRole('radio')
    fireEvent.click(buttons[3])
    
    expect(handleChange).toHaveBeenCalledWith(4)
  })

  it('shows hover state', () => {
    render(<RatingWidget value={0} onChange={() => {}} />)
    
    const buttons = screen.getAllByRole('radio')
    fireEvent.mouseEnter(buttons[1])
    
    expect(buttons[0]).toHaveClass('text-yellow-400')
    expect(buttons[1]).toHaveClass('text-yellow-400')
    expect(buttons[2]).toHaveClass('text-gray-300')
  })

  it('is disabled when readOnly', () => {
    const handleChange = vi.fn()
    render(<RatingWidget value={3} onChange={handleChange} readOnly />)
    
    const buttons = screen.getAllByRole('radio')
    fireEvent.click(buttons[0])
    
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('supports keyboard navigation with ArrowRight', () => {
    const handleChange = vi.fn()
    render(<RatingWidget value={2} onChange={handleChange} />)
    
    const buttons = screen.getAllByRole('radio')
    buttons[1].focus()
    fireEvent.keyDown(buttons[1], { key: 'ArrowRight' })
    
    expect(handleChange).toHaveBeenCalledWith(3)
  })

  it('supports keyboard navigation with ArrowLeft', () => {
    const handleChange = vi.fn()
    render(<RatingWidget value={3} onChange={handleChange} />)
    
    const buttons = screen.getAllByRole('radio')
    buttons[2].focus()
    fireEvent.keyDown(buttons[2], { key: 'ArrowLeft' })
    
    expect(handleChange).toHaveBeenCalledWith(2)
  })

  it('supports Home key to go to first star', () => {
    const handleChange = vi.fn()
    render(<RatingWidget value={4} onChange={handleChange} />)
    
    const buttons = screen.getAllByRole('radio')
    buttons[3].focus()
    fireEvent.keyDown(buttons[3], { key: 'Home' })
    
    expect(handleChange).toHaveBeenCalledWith(1)
  })

  it('supports End key to go to last star', () => {
    const handleChange = vi.fn()
    render(<RatingWidget value={1} onChange={handleChange} />)
    
    const buttons = screen.getAllByRole('radio')
    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'End' })
    
    expect(handleChange).toHaveBeenCalledWith(5)
  })
})
