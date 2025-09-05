const fs = require('fs');
const path = require('path');

/**
 * Custom logging middleware for HTTP requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const logger = (req, res, next) => {
  const startTime = Date.now();
  
  // Get the original res.end function
  const originalEnd = res.end;
  
  // Override res.end to capture response details
  res.end = function(chunk, encoding) {
    // Call the original end function
    originalEnd.call(this, chunk, encoding);
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Create log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: getClientIP(req),
      userId: req.user ? req.user._id : null,
      contentLength: res.get('Content-Length') || 0
    };
    
    // Log to console with color coding
    logToConsole(logEntry);
    
    // Log to file in production
    if (process.env.NODE_ENV === 'production') {
      logToFile(logEntry);
    }
  };
  
  next();
};

/**
 * Get the real client IP address
 * @param {Object} req - Express request object
 * @returns {String} - Client IP address
 */
const getClientIP = (req) => {
  return req.ip ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         'unknown';
};

/**
 * Log to console with color coding based on status code
 * @param {Object} logEntry - Log entry object
 */
const logToConsole = (logEntry) => {
  const { method, url, statusCode, responseTime, ip, userId } = logEntry;
  
  // Color codes for different status ranges
  let statusColor = '';
  if (statusCode >= 500) {
    statusColor = '\x1b[31m'; // Red
  } else if (statusCode >= 400) {
    statusColor = '\x1b[33m'; // Yellow
  } else if (statusCode >= 300) {
    statusColor = '\x1b[36m'; // Cyan
  } else {
    statusColor = '\x1b[32m'; // Green
  }
  
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  
  // Format method with color
  let methodColor = '';
  switch (method) {
    case 'GET':
      methodColor = '\x1b[34m'; // Blue
      break;
    case 'POST':
      methodColor = '\x1b[32m'; // Green
      break;
    case 'PUT':
      methodColor = '\x1b[33m'; // Yellow
      break;
    case 'DELETE':
      methodColor = '\x1b[31m'; // Red
      break;
    default:
      methodColor = '\x1b[37m'; // White
  }
  
  // Create formatted log message
  const timestamp = dim + new Date().toISOString() + reset;
  const methodStr = methodColor + bold + method.padEnd(6) + reset;
  const statusStr = statusColor + bold + statusCode + reset;
  const urlStr = url;
  const timeStr = dim + responseTime + reset;
  const ipStr = dim + ip + reset;
  const userStr = userId ? dim + `user:${userId.toString().slice(-6)}` + reset : '';
  
  console.log(`${timestamp} ${methodStr} ${statusStr} ${urlStr} ${timeStr} ${ipStr} ${userStr}`);
};

/**
 * Log to file for persistent logging
 * @param {Object} logEntry - Log entry object
 */
const logToFile = (logEntry) => {
  try {
    const logDir = path.join(__dirname, '../logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create log file name based on date
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `access-${date}.log`);
    
    // Format log entry as JSON line
    const logLine = JSON.stringify(logEntry) + '\n';
    
    // Append to log file
    fs.appendFileSync(logFile, logLine);
    
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
};

/**
 * Log application events (not HTTP requests)
 * @param {String} level - Log level (info, warn, error)
 * @param {String} message - Log message
 * @param {Object} metadata - Additional metadata
 */
const logEvent = (level, message, metadata = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...metadata
  };
  
  // Color code based on level
  let color = '';
  switch (level.toLowerCase()) {
    case 'error':
      color = '\x1b[31m'; // Red
      break;
    case 'warn':
      color = '\x1b[33m'; // Yellow
      break;
    case 'info':
      color = '\x1b[36m'; // Cyan
      break;
    case 'debug':
      color = '\x1b[37m'; // White
      break;
    default:
      color = '\x1b[37m'; // White
  }
  
  const reset = '\x1b[0m';
  const timestamp = '\x1b[2m' + logEntry.timestamp + reset;
  const levelStr = color + level.toUpperCase().padEnd(5) + reset;
  
  console.log(`${timestamp} ${levelStr} ${message}`);
  
  if (Object.keys(metadata).length > 0) {
    console.log('       ', JSON.stringify(metadata, null, 2));
  }
  
  // Log to file in production
  if (process.env.NODE_ENV === 'production') {
    try {
      const logDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(logDir, `app-${date}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }
};

/**
 * Security event logger for authentication attempts, etc.
 * @param {String} event - Security event type
 * @param {Object} details - Event details
 */
const logSecurityEvent = (event, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'SECURITY',
    event,
    ...details
  };
  
  console.warn('🔒 SECURITY EVENT:', JSON.stringify(logEntry, null, 2));
  
  // Always log security events to file
  try {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `security-${date}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';
    
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error('Error writing to security log:', error);
  }
};

module.exports = {
  logger,
  logEvent,
  logSecurityEvent,
  getClientIP
};