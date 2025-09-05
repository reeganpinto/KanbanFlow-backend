const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }
    
    // Check if token starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Use: Bearer <token>'
      });
    }
    
    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database (excluding password)
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Token is valid but user not found'
        });
      }
      
      // Add user to request object
      req.user = user;
      next();
      
    } catch (tokenError) {
      console.error('Token verification error:', tokenError.message);
      
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired, please login again'
        });
      }
      
      if (tokenError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token verification failed'
      });
    }
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * Used for routes that can work with or without authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      req.user = user;
    } catch (error) {
      // Silently fail for optional auth
      req.user = null;
    }
    
    next();
    
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

/**
 * Check if user is board owner
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isBoardOwner = async (req, res, next) => {
  try {
    const Board = require('../models/Board');
    const boardId = req.params.boardId || req.params.id;
    
    const board = await Board.findById(boardId);
    
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }
    
    if (board.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only board owner can perform this action.'
      });
    }
    
    req.board = board;
    next();
    
  } catch (error) {
    console.error('Board owner check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking board ownership'
    });
  }
};

/**
 * Check if user is board member (including owner)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isBoardMember = async (req, res, next) => {
  try {
    const Board = require('../models/Board');
    const boardId = req.params.boardId || req.params.id;
    
    const board = await Board.findById(boardId);
    
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }
    
    const userId = req.user._id.toString();
    const isOwner = board.ownerId.toString() === userId;
    const isMember = board.members.some(memberId => memberId.toString() === userId);
    
    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this board.'
      });
    }
    
    req.board = board;
    req.isOwner = isOwner;
    next();
    
  } catch (error) {
    console.error('Board member check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking board membership'
    });
  }
};

module.exports = {
  auth,
  optionalAuth,
  isBoardOwner,
  isBoardMember
};