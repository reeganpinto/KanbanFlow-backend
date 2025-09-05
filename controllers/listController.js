const List = require('../models/List');
const Board = require('../models/Board');
const Card = require('../models/Card');
const { validationResult } = require('express-validator');
const { emitToBoardMembers } = require('../socket/socketHandlers');

/**
 * Create a new list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createList = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, boardId } = req.body;
    const userId = req.user._id;

    // Add a check to ensure name is a string
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'List name must be a non-empty string and is required'
      });
    }

    // Check if board exists and user has access
    const board = await Board.findById(boardId);

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    if (!board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }

    // --- START: This is the critical new logic ---
    // Count existing lists to determine the new position
    const listCount = await List.countDocuments({ boardId: board._id });

    // Add this line for debugging to confirm the count
    console.log(`Found ${listCount} lists for this board. Setting new position to: ${listCount}`);
    // --- END: This is the critical new logic ---

    const list = new List({
      name: name.trim(),
      boardId,
      position: listCount // Assign the calculated position
    });

    await list.save();

    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req, boardId, 'list-created', {
        list,
        createdBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'List created successfully',
      data: list
    });

  } catch (error) {
    // This will now catch any other potential errors
    console.error('Create list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create list'
    });
  }
};

/**
 * Update a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateList = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const listId = req.params.id;
    const userId = req.user._id;
    const updateData = req.body;
    
    const list = await List.findById(listId);
    
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(list.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['name', 'cardLimit', 'wipLimit'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });
    
    if (updates.name) updates.name = updates.name.trim();
    
    const updatedList = await List.findByIdAndUpdate(
      listId,
      updates,
      { new: true, runValidators: true }
    );
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req.io, board._id, 'list-updated', {
        list: updatedList,
        updatedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'List updated successfully',
      data: updatedList
    });
    
  } catch (error) {
    console.error('Update list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update list'
    });
  }
};

/**
 * Delete a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteList = async (req, res) => {
  try {
    const listId = req.params.id;
    const userId = req.user._id;
    
    const list = await List.findById(listId);
    
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(list.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // Check if list has cards
    const cardCount = await Card.countDocuments({ listId, archived: false });
    
    if (cardCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete list with ${cardCount} cards. Please move or delete the cards first.`
      });
    }
    
    // Delete the list
    await list.deleteOne();
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req.io, board._id, 'list-deleted', {
        listId,
        deletedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'List deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete list'
    });
  }
};

/**
 * Reorder list position
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const reorderList = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const listId = req.params.id;
    const { position } = req.body;
    const userId = req.user._id;
    
    const list = await List.findById(listId);
    
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(list.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // Move list to new position
    await list.moveToPosition(position);
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req.io, board._id, 'list-reordered', {
        listId,
        newPosition: position,
        reorderedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'List reordered successfully',
      data: list
    });
    
  } catch (error) {
    console.error('Reorder list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder list'
    });
  }
};

/**
 * Archive/Unarchive a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const archiveList = async (req, res) => {
  try {
    const listId = req.params.id;
    const { archived } = req.body;
    const userId = req.user._id;
    
    const list = await List.findById(listId);
    
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(list.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    list.archived = archived;
    await list.save();
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req.io, board._id, 'list-archived', {
        listId,
        archived,
        archivedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: `List ${archived ? 'archived' : 'unarchived'} successfully`,
      data: list
    });
    
  } catch (error) {
    console.error('Archive list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive list'
    });
  }
};

/**
 * Get list with cards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getListWithCards = async (req, res) => {
  try {
    const listId = req.params.id;
    const userId = req.user._id;
    
    const list = await List.findById(listId)
      .populate({
        path: 'cards',
        match: { archived: false },
        options: { sort: { position: 1 } },
        populate: {
          path: 'assignedTo',
          select: 'name email avatarUrl'
        }
      });
    
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(list.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    res.json({
      success: true,
      data: list
    });
    
  } catch (error) {
    console.error('Get list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch list'
    });
  }
};

module.exports = {
  createList,
  updateList,
  deleteList,
  reorderList,
  archiveList,
  getListWithCards
};