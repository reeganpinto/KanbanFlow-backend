const express = require('express');
const router = express.Router();
const {
  getBoards,
  getBoard,
  createBoard,
  updateBoard,
  deleteBoard,
  addMember,
  removeMember,
  getPublicBoards
} = require('../controllers/boardController');
const { auth, isBoardOwner, isBoardMember } = require('../middleware/auth');
const { validate, boardValidationSchemas } = require('../utils/validation');

/**
 * @route   GET /api/boards
 * @desc    Get all boards for authenticated user
 * @access  Private
 */
router.get('/', auth, getBoards);

/**
 * @route   GET /api/boards/public
 * @desc    Get public boards
 * @access  Private
 */
router.get('/public', auth, getPublicBoards);

/**
 * @route   POST /api/boards
 * @desc    Create a new board
 * @access  Private
 */
router.post('/', auth, validate(boardValidationSchemas.create), createBoard);

/**
 * @route   GET /api/boards/:id
 * @desc    Get specific board with lists and cards
 * @access  Private (Board Member)
 */
router.get('/:id', isBoardMember, getBoard);

/**
 * @route   PUT /api/boards/:id
 * @desc    Update board
 * @access  Private (Board Owner)
 */
router.put('/:id', auth, isBoardOwner, validate(boardValidationSchemas.update), updateBoard);

/**
 * @route   DELETE /api/boards/:id
 * @desc    Delete board
 * @access  Private (Board Owner)
 */
router.delete('/:id', auth, isBoardOwner, deleteBoard);

/**
 * @route   POST /api/boards/:id/members
 * @desc    Add member to board
 * @access  Private (Board Owner)
 */
router.post('/:id/members', auth, isBoardOwner, validate(boardValidationSchemas.addMember), addMember);

/**
 * @route   DELETE /api/boards/:id/members/:memberId
 * @desc    Remove member from board
 * @access  Private (Board Owner or Self)
 */
router.delete('/:id/members/:memberId', auth, removeMember);

module.exports = router;