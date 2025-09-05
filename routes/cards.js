const express = require('express');
const router = express.Router();
const {
  createCard,
  getCard,
  updateCard,
  deleteCard,
  moveCard,
  addComment,
  addAttachment,
  getUserCards,
  getOverdueCards
} = require('../controllers/cardController');
const { validate, cardValidationSchemas } = require('../utils/validation');
const { auth } = require('../middleware/auth');

/**
 * @route   GET /api/cards/my-cards
 * @desc    Get user's assigned cards
 * @access  Private
 */
router.get('/my-cards', auth, getUserCards);

/**
 * @route   GET /api/cards/overdue
 * @desc    Get user's overdue cards
 * @access  Private
 */
router.get('/overdue', auth, getOverdueCards);

/**
 * @route   POST /api/cards
 * @desc    Create new card
 * @access  Private (Board Member)
 */
router.post('/', auth, validate(cardValidationSchemas.create), createCard);

/**
 * @route   GET /api/cards/:id
 * @desc    Get card details
 * @access  Private (Board Member)
 */
router.get('/:id', auth, getCard);

/**
 * @route   PUT /api/cards/:id
 * @desc    Update card
 * @access  Private (Board Member)
 */
router.put('/:id', auth, validate(cardValidationSchemas.update), updateCard);

/**
 * @route   DELETE /api/cards/:id
 * @desc    Delete card
 * @access  Private (Board Member)
 */
router.delete('/:id', auth, deleteCard);

/**
 * @route   PUT /api/cards/:id/position
 * @desc    Move card to different list or position
 * @access  Private (Board Member)
 */
router.put('/:id/position', auth, validate(cardValidationSchemas.move), moveCard);

/**
 * @route   POST /api/cards/:id/comments
 * @desc    Add comment to card
 * @access  Private (Board Member)
 */
router.post('/:id/comments', auth, validate(cardValidationSchemas.addComment), addComment);

/**
 * @route   POST /api/cards/:id/attachments
 * @desc    Add attachment to card
 * @access  Private (Board Member)
 */
router.post('/:id/attachments', auth, addAttachment);

module.exports = router;