/**
 * Error handling middleware
 */
import { logError } from './logging.js';

export const errorHandler = (err, req, res, next) => {
  logError(err, req);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((error) => error.message);
    return res.status(400).json({
      error: 'Validation error',
      details: messages,
    });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      error: `${field} already exists`,
    });
  }

  // Custom error messages
  if (err.message.includes('Duplicate rating')) {
    return res.status(409).json({
      error: err.message,
    });
  }

  if (err.message.includes('Unauthorized')) {
    return res.status(403).json({
      error: err.message,
    });
  }

  if (err.message.includes('not found')) {
    return res.status(404).json({
      error: err.message,
    });
  }

  if (err.message.includes('Validation failed')) {
    return res.status(400).json({
      error: err.message,
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
};

/**
 * 404 handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
