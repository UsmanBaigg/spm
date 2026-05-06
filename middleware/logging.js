/**
 * Structured logging middleware with request IDs
 */
import { v4 as uuidv4 } from 'uuid';

// Request ID middleware
export const requestId = (req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Structured logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    type: 'request'
  }));

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      type: 'response'
    }));

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging helper
export const logError = (error, req = null) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: req?.requestId || null,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    method: req?.method || null,
    url: req?.url || null,
    type: 'error'
  }));
};

// Info logging helper
export const logInfo = (message, data = {}, req = null) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: req?.requestId || null,
    message,
    data,
    type: 'info'
  }));
};
