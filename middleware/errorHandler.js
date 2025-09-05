const mongoose = require('mongoose');

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 Error Details:', err);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = {
      name: 'ValidationError',
      message,
      statusCode: 400
    };
  }

  // Mongoose duplicate field error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`;
    error = {
      name: 'DuplicateError',
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(error => error.message).join(', ');
    error = {
      name: 'ValidationError',
      message,
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      name: 'AuthenticationError',
      message,
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      name: 'AuthenticationError',
      message,
      statusCode: 401
    };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    error = {
      name: 'FileUploadError',
      message,
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files uploaded';
    error = {
      name: 'FileUploadError',
      message,
      statusCode: 400
    };
  }

  // Permission errors
  if (err.name === 'PermissionError') {
    error = {
      name: 'PermissionError',
      message: err.message || 'Permission denied',
      statusCode: 403
    };
  }

  // Rate limiting errors
  if (err.name === 'RateLimitError') {
    error = {
      name: 'RateLimitError',
      message: 'Too many requests, please try again later',
      statusCode: 429
    };
  }

  // Default server error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Create error response
  const errorResponse = {
    success: false,
    error: {
      message,
      type: error.name || 'ServerError'
    }
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = err;
  }

  // Add request info for debugging
  if (process.env.NODE_ENV === 'development') {
    errorResponse.request = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }

  // Log error for monitoring
  logError(err, req, statusCode);

  res.status(statusCode).json(errorResponse);
};

/**
 * Error logging function for monitoring and debugging
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Number} statusCode - HTTP status code
 */
const logError = (err, req, statusCode) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? 'ERROR' : 'WARN',
    statusCode,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user._id : null
  };

  // Log to console (in production, you might want to use a proper logging service)
  if (statusCode >= 500) {
    console.error('🚨 SERVER ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (statusCode >= 400) {
    console.warn('⚠️ CLIENT ERROR:', JSON.stringify(errorLog, null, 2));
  }

  // Here you could integrate with external logging services like:
  // - Winston
  // - Sentry
  // - LogRocket
  // - New Relic
  // Example: sentry.captureException(err);
};

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function that catches errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create custom error with status code
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code
 * @returns {Error} - Custom error object
 */
const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Handle 404 errors for undefined routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFound = (req, res, next) => {
  const error = createError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  createError,
  notFound,
  logError
};