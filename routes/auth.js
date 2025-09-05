const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  getUserStats,
  authLimiter,
  strictAuthLimiter
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { validate, authValidationSchemas } = require('../utils/validation');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, validate(authValidationSchemas.register), register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiter, validate(authValidationSchemas.login), login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', auth, getProfile);

/**
 * @route   PUT /api/auth/me
 * @desc    Update user profile
 * @access  Private
 */
router.put('/me', auth, validate(authValidationSchemas.updateProfile), updateProfile);

/**
 * @route   PUT /api/auth/password
 * @desc    Change user password
 * @access  Private
 */
router.put('/password', auth, strictAuthLimiter, [
  require('express-validator').body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  require('express-validator').body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  require('../utils/validation').handleValidationErrors
], changePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', auth, logout);

/**
 * @route   GET /api/auth/stats
 * @desc    Get user statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats', auth, getUserStats);

module.exports = router;