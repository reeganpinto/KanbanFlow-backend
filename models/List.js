const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'List name is required'],
    trim: true,
    minlength: [1, 'List name must be at least 1 character long'],
    maxlength: [100, 'List name cannot exceed 100 characters']
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: [true, 'Board ID is required']
  },
  position: {
    type: Number,
    required: [true, 'List position is required'],
    min: [0, 'Position cannot be negative']
  },
  archived: {
    type: Boolean,
    default: false
  },
  cardLimit: {
    type: Number,
    default: null,
    min: [1, 'Card limit must be at least 1'],
    max: [1000, 'Card limit cannot exceed 1000']
  },
  wipLimit: {
    type: Number,
    default: null,
    min: [1, 'WIP limit must be at least 1'],
    max: [100, 'WIP limit cannot exceed 100']
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
listSchema.index({ boardId: 1, position: 1 });
listSchema.index({ boardId: 1, archived: 1 });
listSchema.index({ createdAt: -1 });

// Virtual for card count
listSchema.virtual('cardCount', {
  ref: 'Card',
  localField: '_id',
  foreignField: 'listId',
  count: true,
  match: { archived: false }
});

// Virtual for cards (will be populated)
listSchema.virtual('cards', {
  ref: 'Card',
  localField: '_id',
  foreignField: 'listId',
  match: { archived: false },
  options: { sort: { position: 1 } }
});

// Pre-save middleware to set position
listSchema.pre('save', async function(next) {
  try {
    if (this.isNew && (this.position === undefined || this.position === null)) {
      // Get the highest position in this board
      const highestList = await this.constructor
        .findOne({ boardId: this.boardId })
        .sort({ position: -1 });
      
      this.position = highestList ? highestList.position + 1 : 0;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to move to position
listSchema.methods.moveToPosition = async function(newPosition) {
  const List = this.constructor;
  
  if (newPosition < 0) {
    throw new Error('Position cannot be negative');
  }
  
  const oldPosition = this.position;
  
  if (oldPosition === newPosition) {
    return this;
  }
  
  // Update positions of other lists
  if (newPosition > oldPosition) {
    // Moving down: decrease position of lists between old and new position
    await List.updateMany(
      {
        boardId: this.boardId,
        position: { $gt: oldPosition, $lte: newPosition },
        _id: { $ne: this._id }
      },
      { $inc: { position: -1 } }
    );
  } else {
    // Moving up: increase position of lists between new and old position
    await List.updateMany(
      {
        boardId: this.boardId,
        position: { $gte: newPosition, $lt: oldPosition },
        _id: { $ne: this._id }
      },
      { $inc: { position: 1 } }
    );
  }
  
  this.position = newPosition;
  return this.save();
};

// Instance method to check if WIP limit is exceeded
listSchema.methods.isWipLimitExceeded = async function() {
  if (!this.wipLimit) return false;
  
  const Card = mongoose.model('Card');
  const cardCount = await Card.countDocuments({
    listId: this._id,
    archived: false
  });
  
  return cardCount > this.wipLimit;
};

// Instance method to check if card limit is exceeded
listSchema.methods.isCardLimitExceeded = async function() {
  if (!this.cardLimit) return false;
  
  const Card = mongoose.model('Card');
  const cardCount = await Card.countDocuments({
    listId: this._id,
    archived: false
  });
  
  return cardCount >= this.cardLimit;
};

// Static method to reorder lists in a board
listSchema.statics.reorderInBoard = async function(boardId, listOrder) {
  const bulkOps = listOrder.map((listId, index) => ({
    updateOne: {
      filter: { _id: listId, boardId: boardId },
      update: { position: index }
    }
  }));
  
  return this.bulkWrite(bulkOps);
};

// Static method to get lists with cards for a board
listSchema.statics.getWithCards = function(boardId) {
  return this.find({ boardId, archived: false })
    .sort({ position: 1 })
    .populate({
      path: 'cards',
      match: { archived: false },
      options: { sort: { position: 1 } },
      populate: {
        path: 'assignedTo',
        select: 'name email avatarUrl'
      }
    });
};

// Middleware to cascade delete cards when list is deleted
listSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const Card = mongoose.model('Card');
    await Card.deleteMany({ listId: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware to update positions when list is deleted
listSchema.post('deleteOne', { document: true, query: false }, async function(doc) {
  try {
    // Decrease position of lists that come after the deleted list
    await this.constructor.updateMany(
      {
        boardId: doc.boardId,
        position: { $gt: doc.position }
      },
      { $inc: { position: -1 } }
    );
  } catch (error) {
    console.error('Error updating list positions after deletion:', error);
  }
});

// Post middleware for logging
listSchema.post('save', function(doc) {
  if (this.isNew) {
    console.log(`📝 New list created: ${doc.name} (${doc._id}) in board ${doc.boardId}`);
  }
});

listSchema.post('deleteOne', function(doc) {
  console.log(`🗑️ List deleted: ${doc.name} (${doc._id})`);
});

module.exports = mongoose.model('List', listSchema);