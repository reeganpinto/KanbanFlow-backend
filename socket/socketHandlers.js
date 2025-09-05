const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logEvent, logSecurityEvent } = require('../middleware/logger');

/**
 * Socket.IO authentication middleware
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} next - Next function
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      logSecurityEvent('socket_auth_failed', {
        reason: 'no_token',
        socketId: socket.id,
        ip: socket.handshake.address
      });
      return next(new Error('Authentication token required'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      logSecurityEvent('socket_auth_failed', {
        reason: 'user_not_found',
        socketId: socket.id,
        userId: decoded.id,
        ip: socket.handshake.address
      });
      return next(new Error('User not found'));
    }
    
    socket.user = user;
    logEvent('info', 'Socket authenticated', {
      userId: user._id,
      socketId: socket.id,
      userName: user.name
    });
    
    next();
    
  } catch (error) {
    logSecurityEvent('socket_auth_failed', {
      reason: 'token_invalid',
      error: error.message,
      socketId: socket.id,
      ip: socket.handshake.address
    });
    next(new Error('Authentication failed'));
  }
};

/**
 * Configure Socket.IO server with event handlers
 * @param {Object} io - Socket.IO server instance
 */
const configureSocket = (io) => {
  // Use authentication middleware
  io.use(authenticateSocket);
  
  io.on('connection', (socket) => {
    const user = socket.user;
    
    logEvent('info', 'User connected via socket', {
      userId: user._id,
      socketId: socket.id,
      userName: user.name
    });
    
    // Handle joining board rooms
    socket.on('join-board', async (boardId) => {
      try {
        // Verify user has access to the board
        const Board = require('../models/Board');
        const board = await Board.findById(boardId);
        
        if (!board) {
          socket.emit('error', { message: 'Board not found' });
          return;
        }
        
        const userId = user._id.toString();
        const isOwner = board.ownerId.toString() === userId;
        const isMember = board.members.some(memberId => memberId.toString() === userId);
        
        if (!isOwner && !isMember) {
          socket.emit('error', { message: 'Access denied to board' });
          logSecurityEvent('unauthorized_board_access', {
            userId: user._id,
            boardId,
            socketId: socket.id
          });
          return;
        }
        
        // Join the board room
        socket.join(`board:${boardId}`);
        socket.currentBoard = boardId;
        
        // Notify other users in the board
        socket.to(`board:${boardId}`).emit('user-joined', {
          userId: user._id,
          userName: user.name,
          avatarUrl: user.avatarUrl
        });
        
        logEvent('info', 'User joined board room', {
          userId: user._id,
          boardId,
          socketId: socket.id
        });
        
        socket.emit('board-joined', { boardId });
        
      } catch (error) {
        console.error('Error joining board:', error);
        socket.emit('error', { message: 'Failed to join board' });
      }
    });
    
    // Handle leaving board rooms
    socket.on('leave-board', (boardId) => {
      try {
        socket.leave(`board:${boardId}`);
        
        // Notify other users in the board
        socket.to(`board:${boardId}`).emit('user-left', {
          userId: user._id
        });
        
        if (socket.currentBoard === boardId) {
          socket.currentBoard = null;
        }
        
        logEvent('info', 'User left board room', {
          userId: user._id,
          boardId,
          socketId: socket.id
        });
        
        socket.emit('board-left', { boardId });
        
      } catch (error) {
        console.error('Error leaving board:', error);
        socket.emit('error', { message: 'Failed to leave board' });
      }
    });
    
    // Handle card movement
    socket.on('move-card', (data) => {
      try {
        const { cardId, sourceListId, targetListId, position, boardId } = data;
        
        if (!socket.currentBoard || socket.currentBoard !== boardId) {
          socket.emit('error', { message: 'Not joined to this board' });
          return;
        }
        
        // Broadcast to other users in the board
        socket.to(`board:${boardId}`).emit('card-moved', {
          cardId,
          sourceListId,
          targetListId,
          position,
          movedBy: {
            userId: user._id,
            userName: user.name
          }
        });
        
        logEvent('info', 'Card moved via socket', {
          userId: user._id,
          cardId,
          sourceListId,
          targetListId,
          position,
          boardId
        });
        
      } catch (error) {
        console.error('Error moving card:', error);
        socket.emit('error', { message: 'Failed to move card' });
      }
    });
    
    // Handle list reordering
    socket.on('reorder-lists', (data) => {
      try {
        const { boardId, listOrder } = data;
        
        if (!socket.currentBoard || socket.currentBoard !== boardId) {
          socket.emit('error', { message: 'Not joined to this board' });
          return;
        }
        
        // Broadcast to other users in the board
        socket.to(`board:${boardId}`).emit('lists-reordered', {
          listOrder,
          reorderedBy: {
            userId: user._id,
            userName: user.name
          }
        });
        
        logEvent('info', 'Lists reordered via socket', {
          userId: user._id,
          boardId,
          listOrder
        });
        
      } catch (error) {
        console.error('Error reordering lists:', error);
        socket.emit('error', { message: 'Failed to reorder lists' });
      }
    });
    
    // Handle typing indicators
    socket.on('typing-start', (data) => {
      const { cardId, boardId } = data;
      
      if (socket.currentBoard === boardId) {
        socket.to(`board:${boardId}`).emit('user-typing', {
          cardId,
          user: {
            userId: user._id,
            userName: user.name
          }
        });
      }
    });
    
    socket.on('typing-stop', (data) => {
      const { cardId, boardId } = data;
      
      if (socket.currentBoard === boardId) {
        socket.to(`board:${boardId}`).emit('user-stopped-typing', {
          cardId,
          userId: user._id
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logEvent('info', 'User disconnected from socket', {
        userId: user._id,
        socketId: socket.id,
        reason,
        currentBoard: socket.currentBoard
      });
      
      // Notify board members if user was in a board
      if (socket.currentBoard) {
        socket.to(`board:${socket.currentBoard}`).emit('user-left', {
          userId: user._id
        });
      }
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      logEvent('error', 'Socket error occurred', {
        userId: user._id,
        socketId: socket.id,
        error: error.message
      });
    });
  });
  
  // Handle connection errors
  io.on('connection_error', (error) => {
    console.error('Socket connection error:', error);
    logEvent('error', 'Socket connection error', { error: error.message });
  });
  
  logEvent('info', 'Socket.IO server configured and ready');
};

/**
 * Emit event to board members
 * @param {Object} io - Socket.IO server instance
 * @param {String} boardId - Board ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToBoardMembers = (req, boardId, event, data) => {
  if (req.io) {
    req.io.to(`board:${boardId}`).emit(event, data);
  }
};

/**
 * Emit event to specific user
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
const emitToUser = (io, userId, event, data) => {
  // This would require mapping userId to socketId
  // For now, we'll implement this when we have user session management
  // io.to(socketId).emit(event, data);
};

module.exports = {
  configureSocket,
  emitToBoardMembers,
  emitToUser,
  authenticateSocket
};