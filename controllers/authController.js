const User = require('../models/User');
const { validationResult } = require('express-validator');
const { logSecurityEvent } = require('../middleware/logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs for sensitive operations
  message: {
    error: 'Too many attempts, please try again later'
  }
});

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logSecurityEvent('registration_validation_failed', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        errors: errors.array()
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      logSecurityEvent('registration_duplicate_email', {
        email: email.toLowerCase(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(400).json({
        success: false,
        message: 'Email address is already registered'
      });
    }
    
    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });
    
    await user.save();
    
    // Generate JWT token
    const token = user.generateAuthToken();
    
    // Log successful registration
    logSecurityEvent('user_registered', {
      userId: user._id,
      email: user.email,
      name: user.name,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Remove password from response
    const userResponse = user.toJSON();
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    logSecurityEvent('registration_error', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already registered'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logSecurityEvent('login_validation_failed', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        errors: errors.array()
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { email, password } = req.body;
    
    try {
      // Find user by credentials
      const user = await User.findByCredentials(email, password);
      
      // Generate JWT token
      const token = user.generateAuthToken();
      
      // Log successful login
      logSecurityEvent('user_logged_in', {
        userId: user._id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Remove sensitive data from response
      const userResponse = user.toJSON();
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token
        }
      });
      
    } catch (loginError) {
      // Log failed login attempt
      logSecurityEvent('login_failed', {
        email: email.toLowerCase(),
        error: loginError.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Return generic error message for security
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    
    logSecurityEvent('login_error', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      data: user
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { name, email, avatarUrl } = req.body;
    const userId = req.user._id;
    
    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== req.user.email) {
      const emailExists = await User.emailExists(email);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email address is already in use'
        });
      }
    }
    
    // Update user
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    logSecurityEvent('profile_updated', {
      userId: user._id,
      updatedFields: Object.keys(updateData),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already in use'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

/**
 * Change user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;
    
    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      logSecurityEvent('password_change_failed', {
        userId: user._id,
        reason: 'invalid_current_password',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    logSecurityEvent('password_changed', {
      userId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

/**
 * Logout user (client-side token removal)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = async (req, res) => {
  try {
    logSecurityEvent('user_logged_out', {
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

/**
 * Get user statistics (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }
    
    const stats = await User.getStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  getUserStats,
  authLimiter,
  strictAuthLimiter
};