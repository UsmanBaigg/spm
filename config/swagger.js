import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trust & Rating Module API',
      version: '1.0.0',
      description: 'REST API for the Trust & Rating Module of the Bring Verified Neighborhood Community Platform',
      contact: {
        name: 'Matrix Group - Backend Development',
        email: 'trust-module@bring.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server',
      },
      {
        url: 'https://api.bring.local/api/v1',
        description: 'Production server',
      },
    ],
    components: {
      schemas: {
        Rating: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'MongoDB ObjectId' },
            raterId: { type: 'string', description: 'ID of the user giving the rating' },
            rateeId: { type: 'string', description: 'ID of the user receiving the rating' },
            stars: { type: 'integer', minimum: 1, maximum: 5 },
            context: { type: 'string', enum: ['marketplace', 'services', 'general'] },
            contextId: { type: 'string', nullable: true },
            raterInfo: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                profileImage: { type: 'string' },
                badge: { type: 'string' },
              },
            },
            isAnonymous: { type: 'boolean' },
            status: { type: 'string', enum: ['active', 'edited', 'flagged', 'deleted'] },
            reportCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'MongoDB ObjectId' },
            ratingId: { type: 'string', description: 'Reference to Rating' },
            raterId: { type: 'string' },
            rateeId: { type: 'string' },
            title: { type: 'string', maxLength: 100 },
            content: { type: 'string', maxLength: 500 },
            context: { type: 'string', enum: ['marketplace', 'services', 'general'] },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['published', 'edited', 'flagged', 'removed', 'admin-removed'] },
            helpfulCount: { type: 'integer' },
            notHelpfulCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TrustProfile: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            score: { type: 'number', minimum: 0, maximum: 100 },
            badge: {
              type: 'string',
              enum: ['new-neighbor', 'community-member', 'trusted-neighbor', 'verified-contributor', 'community-star', 'verified-seller', 'trusted-service-provider'],
            },
            metrics: {
              type: 'object',
              properties: {
                totalRatingsReceived: { type: 'integer' },
                averageRating: { type: 'number' },
                marketplaceRatings: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    average: { type: 'number' },
                  },
                },
                serviceRatings: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    average: { type: 'number' },
                  },
                },
                accountAgeDays: { type: 'integer' },
                verificationStatus: { type: 'string', enum: ['unverified', 'verified', 'premium-verified'] },
                moderationIncidents: { type: 'integer' },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

export const specs = swaggerJsdoc(options);
