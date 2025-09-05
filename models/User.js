const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  avatarUrl: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/empty
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'Avatar URL must be a valid URL'
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ lastLogin: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate avatar URL if not provided
userSchema.pre('save', function(next) {
  if (!this.avatarUrl && this.email) {
    // Generate Gravatar URL as default
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(this.email.toLowerCase()).digest('hex');
    this.avatarUrl = `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
  }
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!candidatePassword) return false;
  
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Instance method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    email: this.email,
    name: this.name,
    role: this.role
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'kanbanflow-api',
      audience: 'kanbanflow-app'
    }
  );
};

// Instance method to update last login
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  return this.save();
};

// Instance method to handle failed login attempts
userSchema.methods.incLoginAttempts = async function() {
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000; // 30 minutes
  
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we have hit max attempts and it's not locked already, lock the account
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  
  // Find user and include password field
  const user = await this.findOne({ email: email.toLowerCase() }).select('+password');
  
  if (!user) {
    throw new Error('Invalid login credentials');
  }
  
  // Check if account is locked
  if (user.isLocked) {
    throw new Error('Account temporarily locked due to too many failed login attempts');
  }
  
  // Check if account is active
  if (!user.isActive) {
    throw new Error('Account has been deactivated');
  }
  
  // Compare password
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    // Increment login attempts
    await user.incLoginAttempts();
    throw new Error('Invalid login credentials');
  }
  
  // Update last login
  await user.updateLastLogin();
  
  return user;
};

// Static method to check if email exists
userSchema.statics.emailExists = async function(email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// Static method to get user stats
userSchema.statics.getStats = async function() {
  const totalUsers = await this.countDocuments();
  const activeUsers = await this.countDocuments({ isActive: true });
  const recentUsers = await this.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });
  
  return {
    totalUsers,
    activeUsers,
    recentUsers,
    inactiveUsers: totalUsers - activeUsers
  };
};

// Error handling for duplicate email
userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern && error.keyPattern.email) {
      next(new Error('Email address is already registered'));
    }
  } else {
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);