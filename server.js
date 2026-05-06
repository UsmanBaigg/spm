import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import { specs } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Routes
import ratingsRouter from './routes/ratings.js';
import reviewsRouter from './routes/reviews.js';
import trustScoreRouter from './routes/trustScore.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bring-trust-rating';

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Database connection
async function connectToMongo() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    // Don't crash the whole API if Mongo isn't up yet; we can retry.
    // Endpoints that require DB data will naturally fail until the connection is ready.
    console.error('❌ MongoDB connection error (will retry):', err?.message || err);
    setTimeout(connectToMongo, 5000);
  }
}

connectToMongo();

// API Documentation
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(specs, {
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

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

app.use(`${apiPrefix}/ratings`, ratingsRouter);
app.use(`${apiPrefix}/reviews`, reviewsRouter);
app.use(`${apiPrefix}/trust`, trustScoreRouter);

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
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

export default app;
