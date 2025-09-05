const Board = require('../models/Board');
const List = require('../models/List');
const Card = require('../models/Card');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { emitToBoardMembers } = require('../socket/socketHandlers');

/**
 * Get all boards for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBoards = async (req, res) => {
  try {
    const userId = req.user._id;
    
    //const boards = await Board.findByUser(userId);
     // Find boards where the user's ID is in the 'members' array OR is the 'ownerId'.
    const boards = await Board.find({
      $or: [
        { ownerId: userId },
        { members: userId }
      ]
    }).populate('ownerId', 'name email avatarUrl')
      .populate('members', 'name email avatarUrl');
    
    res.json({
      success: true,
      data: boards
    });
    
  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch boards'
    });
  }
};

/**
 * Get a specific board with lists and cards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBoard = async (req, res) => {
  try {
    const boardId = req.params.id;
    const userId = req.user._id;
    
    const board = await Board.findById(boardId)
      .populate('ownerId', 'name email avatarUrl')
      .populate('members', 'name email avatarUrl');
    
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }
    
    // Check if user has access to the board
    const isOwner = board.ownerId._id.toString() === userId.toString();
    const isMember = board.members.some(member => member._id.toString() === userId.toString());

    if (!isOwner && !isMember && !board.isPublic) {
      return res.status(403).json({
      success: false,
      message: 'Access denied to this board'
    });
    }
    
    // Get lists with cards
    const lists = await List.getWithCards(boardId);
    
    // Add lists to board response
    const boardResponse = board.toJSON();
    boardResponse.lists = lists;
    
    res.json({
      success: true,
      data: boardResponse
    });
    
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch board'
    });
  }
};

/**
 * Create a new board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBoard = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { name, description, isPublic, backgroundColor, backgroundImage } = req.body;
    const userId = req.user._id;
    
    const board = new Board({
      name: name.trim(),
      description: description?.trim() || '',
      ownerId: userId,
      members: [userId],
      isPublic: isPublic || false,
      backgroundColor: backgroundColor || '#0079bf',
      backgroundImage: backgroundImage || null
    });
    
    await board.save();
    
    // Populate owner information
    await board.populate('ownerId', 'name email avatarUrl');
    
    res.status(201).json({
      success: true,
      message: 'Board created successfully',
      data: board
    });
    
  } catch (error) {
    console.error('Create board error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create board'
    });
  }
};

/**
 * Update a board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBoard = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const boardId = req.params.id;
    const userId = req.user._id;
    const updateData = req.body;
    
    const board = await Board.findById(boardId);
    
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }
    
    // Check if user is owner or has edit permissions
    if (!board.isOwner(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only board owner can update board settings'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['name', 'description', 'isPublic', 'backgroundColor', 'backgroundImage', 'starred', 'settings'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });
    
    if (updates.name) updates.name = updates.name.trim();
    if (updates.description !== undefined) updates.description = updates.description.trim();
    
    const updatedBoard = await Board.findByIdAndUpdate(
      boardId,
      updates,
      { new: true, runValidators: true }
    ).populate('ownerId', 'name email avatarUrl')
     .populate('members', 'name email avatarUrl');
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req.io, boardId, 'board-updated', {
        board: updatedBoard,
        updatedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Board updated successfully',
      data: updatedBoard
    });
    
  } catch (error) {
    console.error('Update board error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update board'
    });
  }
};

/**
 * Delete a board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteBoard = async (req, res) => {
  try {
    const boardId = req.params.id;
    const userId = req.user._id;
    
    const board = await Board.findById(boardId);
    
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }
    
    // Only owner can delete board
    if (!board.isOwner(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only board owner can delete the board'
      });
    }
    
    // Delete the board (cascade delete will handle lists and cards)
    await board.deleteOne();
    
    res.json({
      success: true,
      message: 'Board deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete board'
    });
  }
};

/**
 * Add member to board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addMember = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const boardId = req.params.id;
    const { email } = req.body;
    const userId = req.user._id;
    
    const board = await Board.findById(boardId);
    
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }
    
    // Check if user is owner
    if (!board.isOwner(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only board owner can add members'
      });
    }
    
    // Find user by email
    const userToAdd = await User.findOne({ email: email.toLowerCase() });
    
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email address'
      });
    }
    
    // Check if user is already a member
    if (board.isMember(userToAdd._id)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this board'
      });
    }
    
    // Add member
    board.addMember(userToAdd._id);
    await board.save();
    
    // Populate members for response
    await board.populate('members', 'name email avatarUrl');
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req.io, boardId, 'member-added', {
        boardId,
        member: {
          _id: userToAdd._id,
          name: userToAdd.name,
          email: userToAdd.email,
          avatarUrl: userToAdd.avatarUrl
        },
        addedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Member added successfully',
      data: {
        board,
        addedMember: userToAdd
      }
    });
    
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member'
    });
  }
};

/**
 * Remove member from board
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeMember = async (req, res) => {
  try {
    const boardId = req.params.id;
    const memberIdToRemove = req.params.memberId;
    const userId = req.user._id;
    
    const board = await Board.findById(boardId);
    
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }
    
    // Check if user is owner or removing themselves
    const isOwner = board.isOwner(userId);
    const isSelfRemoval = userId.toString() === memberIdToRemove;
    
    if (!isOwner && !isSelfRemoval) {
      return res.status(403).json({
        success: false,
        message: 'Only board owner can remove members, or members can remove themselves'
      });
    }
    
    // Can't remove owner
    if (board.isOwner(memberIdToRemove)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove board owner'
      });
    }
    
    // Remove member
    board.removeMember(memberIdToRemove);
    await board.save();
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req.io, boardId, 'member-removed', {
        boardId,
        removedMemberId: memberIdToRemove,
        removedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Member removed successfully'
    });
    
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member'
    });
  }
};

/**
 * Get public boards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPublicBoards = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const boards = await Board.findPublic(limit);
    
    res.json({
      success: true,
      data: boards
    });
    
  } catch (error) {
    console.error('Get public boards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public boards'
    });
  }
};

module.exports = {
  getBoards,
  getBoard,
  createBoard,
  updateBoard,
  deleteBoard,
  addMember,
  removeMember,
  getPublicBoards
};