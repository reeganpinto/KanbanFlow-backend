const express = require('express');
const router = express.Router();
const {
  createList,
  updateList,
  deleteList,
  reorderList,
  archiveList,
  getListWithCards
} = require('../controllers/listController');
const { validate, listValidationSchemas } = require('../utils/validation');
const { auth } = require('../middleware/auth');

/**
 * @route   POST /api/lists
 * @desc    Create new list
 * @access  Private (Board Member)
 */
router.post('/', auth, validate(listValidationSchemas.create), createList);

/**
 * @route   GET /api/lists/:id
 * @desc    Get list with cards
 * @access  Private (Board Member)
 */
router.get('/:id', auth, getListWithCards);

/**
 * @route   PUT /api/lists/:id
 * @desc    Update list
 * @access  Private (Board Member)
 */
router.put('/:id', auth, validate(listValidationSchemas.update), updateList);

/**
 * @route   DELETE /api/lists/:id
 * @desc    Delete list
 * @access  Private (Board Member)
 */
router.delete('/:id', auth, deleteList);

/**
 * @route   PUT /api/lists/:id/position
 * @desc    Reorder list position
 * @access  Private (Board Member)
 */
router.put('/:id/position', auth, validate(listValidationSchemas.reorder), reorderList);

/**
 * @route   PUT /api/lists/:id/archive
 * @desc    Archive/Unarchive list
 * @access  Private (Board Member)
 */
router.put('/:id/archive', auth, [
  require('express-validator').body('archived')
    .isBoolean()
    .withMessage('Archived must be a boolean value'),
  require('../utils/validation').handleValidationErrors
], archiveList);

module.exports = router;