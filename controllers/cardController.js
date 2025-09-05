const Card = require('../models/Card');
const List = require('../models/List');
const Board = require('../models/Board');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { emitToBoardMembers } = require('../socket/socketHandlers');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed'));
    }
  }
});

/**
 * Create a new card
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createCard = async (req, res) => {
  console.log('Server received this request body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, listId, boardId } = req.body;
    const userId = req.user._id;

    // Check user has access to the board
    const board = await Board.findById(boardId);
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // --- START: This is the critical new logic ---
    // Count existing cards in the list to determine the new position
    const cardCount = await Card.countDocuments({ listId });
    // --- END: This is the critical new logic ---

    const newCard = new Card({
      title,
      listId,
      boardId,
      createdBy: userId,
      position: cardCount // Assign the calculated position
    });

    await newCard.save();

    // Populate createdBy for the socket event
    await newCard.populate('createdBy', 'name email');

    if (req.io) {
      emitToBoardMembers(req, boardId, 'card-created', {
        card: newCard,
        listId: listId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Card created successfully',
      data: newCard
    });

  } catch (error) {
    console.error('Create card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create card'
    });
  }
};



/**
 * Get card details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCard = async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user._id;
    
    const card = await Card.findById(cardId)
      .populate('assignedTo', 'name email avatarUrl')
      .populate('comments.userId', 'name email avatarUrl')
      .populate('attachments.uploadedBy', 'name email avatarUrl');
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(card.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    res.json({
      success: true,
      data: card
    });
    
  } catch (error) {
    console.error('Get card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch card'
    });
  }
};

/**
 * Update a card
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateCard = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const cardId = req.params.id;
    const userId = req.user._id;
    const updateData = req.body;
    
    const card = await Card.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(card.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'assignedTo', 'dueDate', 'completed', 
      'priority', 'labels', 'estimatedHours', 'actualHours', 'startDate'
    ];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });
    
    if (updates.title) updates.title = updates.title.trim();
    if (updates.description !== undefined) updates.description = updates.description.trim();
    
    // Set completedBy if marking as completed
    if (updates.completed && !card.completed) {
      updates.completedBy = userId;
    }
    
    const updatedCard = await Card.findByIdAndUpdate(
      cardId,
      updates,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email avatarUrl')
     .populate('completedBy', 'name email avatarUrl');
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req, board._id, 'card-updated', {
        card: updatedCard,
        updatedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Card updated successfully',
      data: updatedCard
    });
    
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update card'
    });
  }
};

/**
 * Delete a card
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteCard = async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user._id;
    
    const card = await Card.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(card.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // Delete the card
    await card.deleteOne();
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req, board._id, 'card-deleted', {
        cardId,
        deletedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete card'
    });
  }
};

/**
 * Move card to different list or position
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const moveCard = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const cardId = req.params.id;
    const { listId, position } = req.body;
    const userId = req.user._id;
    
    const card = await Card.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(card.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // If moving to different list, check if target list exists
    if (listId !== card.listId.toString()) {
      const targetList = await List.findById(listId);
      
      if (!targetList) {
        return res.status(404).json({
          success: false,
          message: 'Target list not found'
        });
      }
      
      if (targetList.boardId.toString() !== card.boardId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot move card to list in different board'
        });
      }
      
      // Check if target list has card limit
      if (await targetList.isCardLimitExceeded()) {
        return res.status(400).json({
          success: false,
          message: 'Target list has reached its card limit'
        });
      }
    }
    
    const oldListId = card.listId.toString();
    
    // Move card
    await card.moveToList(listId, position);
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req, board._id, 'card-moved', {
        cardId,
        oldListId,
        newListId: listId,
        newPosition: card.position,
        movedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Card moved successfully',
      data: card
    });
    
  } catch (error) {
    console.error('Move card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move card'
    });
  }
};

/**
 * Add comment to card
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const cardId = req.params.id;
    const { text } = req.body;
    const userId = req.user._id;
    
    const card = await Card.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(card.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // Add comment
    await card.addComment(userId, text);
    
    // Populate the new comment
    await card.populate('comments.userId', 'name email avatarUrl');
    
    const newComment = card.comments[card.comments.length - 1];
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req, board._id, 'comment-added', {
        cardId,
        comment: newComment,
        addedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: newComment
    });
    
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
};

/**
 * Add attachment to card
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addAttachment = async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user._id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const card = await Card.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    // Check if user has access to the board
    const board = await Board.findById(card.boardId);
    
    if (!board || !board.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this board'
      });
    }
    
    // Create attachment data
    const attachmentData = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: userId
    };
    
    // Add attachment
    await card.addAttachment(attachmentData);
    
    // Populate the new attachment
    await card.populate('attachments.uploadedBy', 'name email avatarUrl');
    
    const newAttachment = card.attachments[card.attachments.length - 1];
    
    // Emit update to board members
    if (req.io) {
      emitToBoardMembers(req, board._id, 'attachment-added', {
        cardId,
        attachment: newAttachment,
        addedBy: {
          userId: req.user._id,
          userName: req.user.name
        }
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Attachment added successfully',
      data: newAttachment
    });
    
  } catch (error) {
    console.error('Add attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add attachment'
    });
  }
};

/**
 * Get user's assigned cards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserCards = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const cards = await Card.findByUser(userId);
    
    res.json({
      success: true,
      data: cards
    });
    
  } catch (error) {
    console.error('Get user cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user cards'
    });
  }
};

/**
 * Get overdue cards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOverdueCards = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const cards = await Card.findOverdue(userId);
    
    res.json({
      success: true,
      data: cards
    });
    
  } catch (error) {
    console.error('Get overdue cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue cards'
    });
  }
};

module.exports = {
  createCard,
  getCard,
  updateCard,
  deleteCard,
  moveCard,
  addComment,
  addAttachment: [upload.single('attachment'), addAttachment],
  getUserCards,
  getOverdueCards
};