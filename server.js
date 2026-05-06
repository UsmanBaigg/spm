import express from 'express';
import { supabase } from './config/supabase.js';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import prometheus from 'prom-client';

import MetricsCollector from './monitoring/metrics.js';
import { specs } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestId, requestLogger } from './middleware/logging.js';
import { generalLimiter, strictLimiter, submissionLimiter } from './middleware/rateLimit.js';

// Routes
import ratingsRouter from './routes/ratings.js';
import reviewsRouter from './routes/reviews.js';
import trustScoreRouter from './routes/trustScore.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(MetricsCollector.middleware());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

// Request ID and logging middleware
app.use(requestId);
app.use(requestLogger);

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Supabase is initialized via config/supabase.js
console.log('✅ Supabase client initialized');

// API Documentation
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(specs, {
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

// Prometheus Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Trust & Rating Module',
  });
});

// API Routes
const apiPrefix = '/api/v1';

// Apply submission rate limiting to POST/PUT/DELETE endpoints
app.use(`${apiPrefix}/ratings/submit`, submissionLimiter);
app.use(`${apiPrefix}/ratings`, ratingsRouter);
app.use(`${apiPrefix}/reviews`, submissionLimiter);
app.use(`${apiPrefix}/reviews`, reviewsRouter);
app.use(`${apiPrefix}/trust`, strictLimiter, trustScoreRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Trust & Rating Module API',
    version: '1.0.0',
    status: 'running',
    docs: '/api-docs',
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   Trust & Rating Module - Backend Server                   ║
╠════════════════════════════════════════════════════════════╣
║   Server running on: http://localhost:${PORT}                      ║
║   API Documentation: http://localhost:${PORT}/api-docs         ║
║   Health Check: http://localhost:${PORT}/health                ║
║   Environment: ${process.env.NODE_ENV || 'development'}                       ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
