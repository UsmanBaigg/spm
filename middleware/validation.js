import Joi from 'joi';

// Validation schemas
const schemas = {
  submitRating: Joi.object({
    raterId: Joi.string().required(),
    rateeId: Joi.string().required(),
    stars: Joi.number().integer().min(1).max(5).required(),
    context: Joi.string().valid('marketplace', 'services', 'general').default('general'),
    contextId: Joi.string().optional().allow(null),
    raterInfo: Joi.object({
      username: Joi.string().optional(),
      profileImage: Joi.string().uri().optional(),
      badge: Joi.string().optional(),
    }).optional(),
  }),

  editRating: Joi.object({
    ratingId: Joi.string().required(),
    raterId: Joi.string().required(),
    newStars: Joi.number().integer().min(1).max(5).required(),
    reviewText: Joi.string().max(500).optional().allow(null),
  }),

  createReview: Joi.object({
    ratingId: Joi.string().required(),
    raterId: Joi.string().required(),
    content: Joi.string().min(10).max(500).required(),
    context: Joi.string().valid('marketplace', 'services', 'general').default('general'),
    title: Joi.string().max(100).optional().allow(null),
    tags: Joi.array()
      .items(
        Joi.string().valid(
          'helpful',
          'reliable',
          'friendly',
          'professional',
          'poor-quality',
          'unresponsive',
          'dishonest'
        )
      )
      .optional(),
  }),

  editReview: Joi.object({
    reviewId: Joi.string().required(),
    raterId: Joi.string().required(),
    content: Joi.string().min(10).max(500).required(),
    tags: Joi.array()
      .items(
        Joi.string().valid(
          'helpful',
          'reliable',
          'friendly',
          'professional',
          'poor-quality',
          'unresponsive',
          'dishonest'
        )
      )
      .optional(),
  }),

  reportReview: Joi.object({
    reviewId: Joi.string().required(),
    reason: Joi.string().valid('spam', 'offensive', 'fake', 'harassment', 'inappropriate').required(),
  }),

  getTrustProfile: Joi.object({
    userId: Joi.string().required(),
  }),
};

/**
 * Validate request body against schema
 */
export const validateRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      return res.status(500).json({ error: `Validation schema '${schemaName}' not found` });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages,
      });
    }

    // Replace body with validated value
    req.body = value;
    next();
  };
};

/**
 * Validate params
 */
export const validateParams = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      return res.status(500).json({ error: `Validation schema '${schemaName}' not found` });
    }

    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages,
      });
    }

    req.params = value;
    next();
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      context: Joi.string().valid('marketplace', 'services', 'general').optional(),
      sortBy: Joi.string().optional(),
    });

    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages,
      });
    }

    req.query = value;
    next();
  };
};
