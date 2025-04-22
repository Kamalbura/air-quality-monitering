/**
 * Security middleware for air quality monitoring application
 */
const helmet = require('helmet');

function setupSecurity(app) {
  // Set security headers using Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'cdn.jsdelivr.net', "'unsafe-inline'"],
        styleSrc: ["'self'", 'cdn.jsdelivr.net', "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'cdn.jsdelivr.net'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"]
      }
    },
    // Disable X-Powered-By header
    hidePoweredBy: true,
    // Prevent clickjacking
    frameguard: {
      action: 'deny'
    },
    // Don't allow the browser to MIME-sniff
    noSniff: true,
    // Prevent XSS attacks
    xssFilter: true
  }));
  
  // Rate limiting middleware (basic implementation)
  const requestCounts = {};
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const RATE_LIMIT_MAX_REQUESTS = 100;    // 100 requests per minute
  
  app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Initialize or reset expired entry
    if (!requestCounts[ip] || requestCounts[ip].windowStart < now - RATE_LIMIT_WINDOW_MS) {
      requestCounts[ip] = {
        count: 1,
        windowStart: now
      };
      return next();
    }
    
    // Increment count
    requestCounts[ip].count++;
    
    // Check if rate limit exceeded
    if (requestCounts[ip].count > RATE_LIMIT_MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Too many requests, please try again later.'
      });
    }
    
    next();
  });
  
  // Prevent sensitive information exposure
  app.use((req, res, next) => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    next();
  });
  
  // Validate content types for POST/PUT requests
  app.use((req, res, next) => {
    if (['POST', 'PUT'].includes(req.method)) {
      const contentType = req.headers['content-type'] || '';
      
      if (!contentType.includes('application/json') && 
          !contentType.includes('application/x-www-form-urlencoded') &&
          !contentType.includes('multipart/form-data')) {
        return res.status(415).json({
          error: 'Unsupported Media Type'
        });
      }
    }
    next();
  });
}

module.exports = setupSecurity;
