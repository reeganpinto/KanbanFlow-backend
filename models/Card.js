const mongoose = require('mongoose');

// Sub-schema for comments
const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: [true, 'Comment text is required'],
    trim: true,
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true
});

// Sub-schema for attachments
const attachmentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true
});

// Sub-schema for checklist items
const checklistItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Checklist item cannot exceed 200 characters']
  },
  completed: {
    type: Boolean,
    default: false
  },
  position: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  _id: true
});

const cardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Card title is required'],
    trim: true,
    minlength: [1, 'Card title must be at least 1 character long'],
    maxlength: [200, 'Card title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Card description cannot exceed 2000 characters'],
    default: ''
  },
  listId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'List',
    required: [true, 'List ID is required']
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: [true, 'Board ID is required']
  },
  position: {
    type: Number,
    required: [true, 'Card position is required'],
    min: [0, 'Position cannot be negative']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  

  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dueDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return v > new Date();
      },
      message: 'Due date must be in the future'
    }
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  labels: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    color: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Label color must be a valid hex color'
      }
    }
  }],
  attachments: [attachmentSchema],
  comments: [commentSchema],
  checklist: [checklistItemSchema],
  archived: {
    type: Boolean,
    default: false
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative'],
    max: [1000, 'Estimated hours cannot exceed 1000'],
    default: null
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative'],
    max: [1000, 'Actual hours cannot exceed 1000'],
    default: null
  },
  startDate: {
    type: Date,
    default: null
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
cardSchema.index({ listId: 1, position: 1 });
cardSchema.index({ boardId: 1 });
cardSchema.index({ assignedTo: 1 });
cardSchema.index({ dueDate: 1 });
cardSchema.index({ completed: 1 });
cardSchema.index({ createdAt: -1 });
cardSchema.index({ title: 'text', description: 'text' });

// Virtual for overdue status
cardSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.completed) return false;
  return new Date() > this.dueDate;
});

// Virtual for checklist completion percentage
cardSchema.virtual('checklistProgress').get(function() {
  if (!this.checklist || this.checklist.length === 0) return 0;
  
  const completedItems = this.checklist.filter(item => item.completed).length;
  return Math.round((completedItems / this.checklist.length) * 100);
});

// Virtual for attachment count
cardSchema.virtual('attachmentCount').get(function() {
  return this.attachments ? this.attachments.length : 0;
});

// Virtual for comment count
cardSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Pre-save middleware to set position
cardSchema.pre('save', async function(next) {
  try {
    if (this.isNew && (this.position === undefined || this.position === null)) {
      // Get the highest position in this list
      const highestCard = await this.constructor
        .findOne({ listId: this.listId, archived: false })
        .sort({ position: -1 });
      
      this.position = highestCard ? highestCard.position + 1 : 0;
    }
    
    // Set completion timestamp when marked as completed
    if (this.isModified('completed')) {
      if (this.completed) {
        this.completedAt = new Date();
      } else {
        this.completedAt = null;
        this.completedBy = null;
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to move to different list or position
cardSchema.methods.moveToList = async function(newListId, newPosition = null) {
  const Card = this.constructor;
  const oldListId = this.listId;
  const oldPosition = this.position;
  
  // If moving to same list and no position specified, do nothing
  if (oldListId.toString() === newListId && newPosition === null) {
    return this;
  }
  
  // If moving to a different list
  if (oldListId.toString() !== newListId) {
    // Decrease positions in the old list
    await Card.updateMany(
      {
        listId: oldListId,
        position: { $gt: oldPosition }
      },
      { $inc: { position: -1 } }
    );
    
    // If no position is specified for the new list, move it to the end
    if (newPosition === null) {
      newPosition = await Card.countDocuments({ listId: newListId });
    }

    // Increase positions in the new list to make space
    await Card.updateMany(
      {
        listId: newListId, // Mongoose handles string conversion here in modern versions, but being explicit is safer
        position: { $gte: newPosition }
      },
      { $inc: { position: 1 } }
    );
  } else { // If moving within the same list
    if (newPosition === oldPosition) return this;
    
    if (newPosition > oldPosition) {
      // Moving down: decrease position of cards between old and new position
      await Card.updateMany(
        {
          listId: oldListId,
          position: { $gt: oldPosition, $lte: newPosition },
          _id: { $ne: this._id }
        },
        { $inc: { position: -1 } }
      );
    } else {
      // Moving up: increase position of cards between new and old position
      await Card.updateMany(
        {
          listId: oldListId,
          position: { $gte: newPosition, $lt: oldPosition },
          _id: { $ne: this._id }
        },
        { $inc: { position: 1 } }
      );
    }
  }
  
  this.listId = newListId;
  this.position = newPosition;
  return this.save();
};

// Instance method to add attachment
cardSchema.methods.addAttachment = function(attachmentData) {
  this.attachments.push(attachmentData);
  return this.save();
};

// Instance method to remove attachment
cardSchema.methods.removeAttachment = function(attachmentId) {
  this.attachments = this.attachments.filter(
    attachment => attachment._id.toString() !== attachmentId.toString()
  );
  return this.save();
};

// Instance method to add checklist item
cardSchema.methods.addChecklistItem = function(text) {
  const position = this.checklist.length;
  this.checklist.push({
    text: text.trim(),
    completed: false,
    position
  });
  return this.save();
};

// Instance method to toggle checklist item
cardSchema.methods.toggleChecklistItem = function(itemId) {
  const item = this.checklist.id(itemId);
  if (item) {
    item.completed = !item.completed;
  }
  return this.save();
};

// Instance method to assign user
cardSchema.methods.assignUser = function(userId) {
  const userIdStr = userId.toString();
  if (!this.assignedTo.some(id => id.toString() === userIdStr)) {
    this.assignedTo.push(userId);
  }
  return this.save();
};

// Instance method to unassign user
cardSchema.methods.unassignUser = function(userId) {
  const userIdStr = userId.toString();
  this.assignedTo = this.assignedTo.filter(id => id.toString() !== userIdStr);
  return this.save();
};

// Static method to get cards by user
cardSchema.statics.findByUser = function(userId) {
  return this.find({
    assignedTo: userId,
    archived: false
  }).populate('listId', 'name')
    .populate('boardId', 'name')
    .populate('assignedTo', 'name email avatarUrl')
    .sort({ dueDate: 1, createdAt: -1 });
};

// Static method to get overdue cards
cardSchema.statics.findOverdue = function(userId = null) {
  const query = {
    dueDate: { $lt: new Date() },
    completed: false,
    archived: false
  };
  
  if (userId) {
    query.assignedTo = userId;
  }
  
  return this.find(query)
    .populate('listId', 'name')
    .populate('boardId', 'name')
    .populate('assignedTo', 'name email avatarUrl')
    .sort({ dueDate: 1 });
};

// Middleware to update positions when card is deleted
cardSchema.post('deleteOne', { document: true, query: false }, async function(doc) {
  try {
    // Decrease position of cards that come after the deleted card
    await this.constructor.updateMany(
      {
        listId: doc.listId,
        position: { $gt: doc.position },
        archived: false
      },
      { $inc: { position: -1 } }
    );
  } catch (error) {
    console.error('Error updating card positions after deletion:', error);
  }
});

// Post middleware for logging
cardSchema.post('save', function(doc) {
  if (this.isNew) {
    console.log(`🎴 New card created: ${doc.title} (${doc._id}) in list ${doc.listId}`);
  }
});

cardSchema.post('deleteOne', function(doc) {
  console.log(`🗑️ Card deleted: ${doc.title} (${doc._id})`);
});

module.exports = mongoose.model('Card', cardSchema);