import prometheus from 'prom-client';

class MetricsCollector {
  static createMetrics() {
    const httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code']
    });

    const httpRequestTotal = new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    const databaseQueryDuration = new prometheus.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['collection', 'operation']
    });

    const activeConnections = new prometheus.Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    });

    return {
      httpRequestDuration,
      httpRequestTotal,
      databaseQueryDuration,
      activeConnections
    };
  }

  static middleware() {
    const metrics = this.createMetrics();
    
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        
        metrics.httpRequestDuration
          .labels(req.method, route, res.statusCode)
          .observe(duration);
        
        metrics.httpRequestTotal
          .labels(req.method, route, res.statusCode)
          .inc();
      });
      
      next();
    };
  }
}

export default MetricsCollector;
