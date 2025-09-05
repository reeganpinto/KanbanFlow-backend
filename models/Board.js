const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Board name is required'],
    trim: true,
    minlength: [1, 'Board name must be at least 1 character long'],
    maxlength: [100, 'Board name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Board description cannot exceed 500 characters'],
    default: ''
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Board owner is required']
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  backgroundColor: {
    type: String,
    default: '#0079bf',
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'Background color must be a valid hex color'
    }
  },
  backgroundImage: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'Background image must be a valid URL'
    }
  },
  starred: {
    type: Boolean,
    default: false
  },
  archived: {
    type: Boolean,
    default: false
  },
  settings: {
    allowComments: {
      type: Boolean,
      default: true
    },
    allowVoting: {
      type: Boolean,
      default: false
    },
    cardAging: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
boardSchema.index({ ownerId: 1 });
boardSchema.index({ members: 1 });
boardSchema.index({ createdAt: -1 });
boardSchema.index({ name: 'text', description: 'text' });

// Virtual for member count
boardSchema.virtual('memberCount').get(function() {
  // If this.members doesn't exist, return 1 (for the owner). Otherwise, calculate correctly.
  return (this.members ? this.members.length : 0) + 1;
});

// Virtual for checking if board has lists
boardSchema.virtual('hasLists', {
  ref: 'List',
  localField: '_id',
  foreignField: 'boardId',
  count: true
});

// Virtual for checking if board has cards
boardSchema.virtual('hasCards', {
  ref: 'Card',
  localField: '_id',
  foreignField: 'boardId',
  count: true
});

// Pre-save middleware
boardSchema.pre('save', function(next) {
  // Ensure owner is not in members array
  if (this.ownerId && this.members.length > 0) {
    this.members = this.members.filter(
      memberId => !memberId.equals(this.ownerId)
    );
  }
  next();
});

// Instance method to check if user is owner
boardSchema.methods.isOwner = function(userId) {
  return this.ownerId.toString() === userId.toString();
};

// Instance method to check if user is member (including owner)
boardSchema.methods.isMember = function(userId) {
  const userIdStr = userId.toString();
  return this.ownerId.toString() === userIdStr || 
         this.members.some(memberId => memberId.toString() === userIdStr);
};

// Instance method to add member
boardSchema.methods.addMember = function(userId) {
  const userIdStr = userId.toString();
  
  // Don't add owner as member
  if (this.ownerId.toString() === userIdStr) {
    return this;
  }
  
  // Don't add if already a member
  if (this.members.some(memberId => memberId.toString() === userIdStr)) {
    return this;
  }
  
  this.members.push(userId);
  return this;
};

// Instance method to remove member
boardSchema.methods.removeMember = function(userId) {
  const userIdStr = userId.toString();
  this.members = this.members.filter(
    memberId => memberId.toString() !== userIdStr
  );
  return this;
};

// Instance method to get all board members including owner
boardSchema.methods.getAllMembers = function() {
  return [this.ownerId, ...this.members];
};

// Static method to find boards by user
boardSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { ownerId: userId },
      { members: userId }
    ],
    archived: false
  }).populate('ownerId', 'name email avatarUrl')
    .populate('members', 'name email avatarUrl')
    .sort({ updatedAt: -1 });
};

// Static method to find public boards
boardSchema.statics.findPublic = function(limit = 20) {
  return this.find({
    isPublic: true,
    archived: false
  }).populate('ownerId', 'name email avatarUrl')
    .populate('members', 'name email avatarUrl')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get board with full details
boardSchema.statics.getWithDetails = function(boardId) {
  return this.findById(boardId)
    .populate('ownerId', 'name email avatarUrl')
    .populate('members', 'name email avatarUrl')
    .populate({
      path: 'lists',
      options: { sort: { position: 1 } },
      populate: {
        path: 'cards',
        options: { sort: { position: 1 } },
        populate: {
          path: 'assignedTo',
          select: 'name email avatarUrl'
        }
      }
    });
};

// Virtual for lists (will be populated)
boardSchema.virtual('lists', {
  ref: 'List',
  localField: '_id',
  foreignField: 'boardId'
});

// Middleware to cascade delete
boardSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    // Delete all lists in this board
    const List = mongoose.model('List');
    await List.deleteMany({ boardId: this._id });
    
    // Delete all cards in this board
    const Card = mongoose.model('Card');
    await Card.deleteMany({ boardId: this._id });
    
    next();
  } catch (error) {
    next(error);
  }
});

// Post middleware for logging
boardSchema.post('save', function(doc) {
  if (this.isNew) {
    console.log(`📋 New board created: ${doc.name} (${doc._id})`);
  }
});

boardSchema.post('deleteOne', function(doc) {
  console.log(`🗑️ Board deleted: ${doc.name} (${doc._id})`);
});

module.exports = mongoose.model('Board', boardSchema);