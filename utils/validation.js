const joi = require('joi');

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

// Authentication validation schemas
const authValidationSchemas = {
  register: joi.object({
    name: joi.string().trim().min(2).max(50).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    }),
    email: joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: joi.string().min(6).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required'
    }),
    confirmPassword: joi.string().valid(joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your password'
    })
  }),

  login: joi.object({
    email: joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  updateProfile: joi.object({
    name: joi.string().trim().min(2).max(50).messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters'
    }),
    email: joi.string().email().messages({
      'string.email': 'Please provide a valid email address'
    }),
    avatarUrl: joi.string().uri().allow('').messages({
      'string.uri': 'Avatar URL must be a valid URL'
    })
  }),

  updatePassword: joi.object({
    currentPassword: joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: joi.string().min(6).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'New password must be at least 6 characters long',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'New password is required'
    })
  }),

  forgotPassword: joi.object({
    email: joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
  }),

  resetPassword: joi.object({
    password: joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
    token: joi.string().required().messages({
      'any.required': 'Reset token is required'
    })
  })
};

// Board validation schemas
const boardValidationSchemas = {
  create: joi.object({
    name: joi.string().trim().min(1).max(100).required().messages({
      'string.min': 'Board name must be at least 1 character long',
      'string.max': 'Board name cannot exceed 100 characters',
      'any.required': 'Board name is required'
    }),
    description: joi.string().trim().max(500).allow('').messages({
      'string.max': 'Board description cannot exceed 500 characters'
    }),
    isPublic: joi.boolean(),
    backgroundColor: joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).messages({
      'string.pattern.base': 'Background color must be a valid hex color'
    }),
    backgroundImage: joi.string().uri().allow('').messages({
      'string.uri': 'Background image must be a valid URL'
    })
  }),
  
  update: joi.object({
    name: joi.string().trim().min(1).max(100).messages({
      'string.min': 'Board name must be at least 1 character long',
      'string.max': 'Board name cannot exceed 100 characters'
    }),
    description: joi.string().trim().max(500).allow('').messages({
      'string.max': 'Board description cannot exceed 500 characters'
    }),
    isPublic: joi.boolean(),
    backgroundColor: joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).messages({
      'string.pattern.base': 'Background color must be a valid hex color'
    }),
    backgroundImage: joi.string().uri().allow('').messages({
      'string.uri': 'Background image must be a valid URL'
    }),
    starred: joi.boolean(),
    settings: joi.object({
      allowComments: joi.boolean(),
      allowVoting: joi.boolean(),
      cardAging: joi.boolean()
    })
  }),
  
  addMember: joi.object({
    email: joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
  })
};

// List validation schemas
const listValidationSchemas = {
  create: joi.object({
    name: joi.string().trim().min(1).max(100).required().messages({
      'string.min': 'List name must be at least 1 character long',
      'string.max': 'List name cannot exceed 100 characters',
      'any.required': 'List name is required'
    }),
    boardId: joi.string().required().messages({
      'any.required': 'Board ID is required'
    }),
    position: joi.number().min(0).messages({
      'number.min': 'Position cannot be negative'
    })
  }),
  
  update: joi.object({
    name: joi.string().trim().min(1).max(100).messages({
      'string.min': 'List name must be at least 1 character long',
      'string.max': 'List name cannot exceed 100 characters'
    }),
    cardLimit: joi.number().min(1).max(1000).allow(null).messages({
      'number.min': 'Card limit must be at least 1',
      'number.max': 'Card limit cannot exceed 1000'
    }),
    wipLimit: joi.number().min(1).max(100).allow(null).messages({
      'number.min': 'WIP limit must be at least 1',
      'number.max': 'WIP limit cannot exceed 100'
    })
  }),
  
  reorder: joi.object({
    position: joi.number().min(0).required().messages({
      'number.min': 'Position cannot be negative',
      'any.required': 'Position is required'
    })
  })
};

// Card validation schemas
const cardValidationSchemas = {
  create: joi.object({
    title: joi.string().trim().min(1).max(200).required().messages({
      'string.min': 'Card title must be at least 1 character long',
      'string.max': 'Card title cannot exceed 200 characters',
      'any.required': 'Card title is required'
    }),
    description: joi.string().trim().max(2000).allow('').messages({
      'string.max': 'Card description cannot exceed 2000 characters'
    }),
    listId: joi.string().required().messages({
      'any.required': 'List ID is required'
    }),
     boardId: joi.string().required().messages({
      'any.required': 'Board ID is required'
    }),
    assignedTo: joi.array().items(joi.string()),
    dueDate: joi.date().greater('now').allow(null).messages({
      'date.greater': 'Due date must be in the future'
    }),
    priority: joi.string().valid('low', 'medium', 'high', 'urgent').messages({
      'any.only': 'Priority must be one of: low, medium, high, urgent'
    }),
    labels: joi.array().items(joi.object({
      name: joi.string().trim().max(50).required(),
      color: joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required()
    }))
  }),
  
  update: joi.object({
    title: joi.string().trim().min(1).max(200).messages({
      'string.min': 'Card title must be at least 1 character long',
      'string.max': 'Card title cannot exceed 200 characters'
    }),
    description: joi.string().trim().max(2000).allow('').messages({
      'string.max': 'Card description cannot exceed 2000 characters'
    }),
    assignedTo: joi.array().items(joi.string()),
    dueDate: joi.date().allow(null),
    completed: joi.boolean(),
    priority: joi.string().valid('low', 'medium', 'high', 'urgent').messages({
      'any.only': 'Priority must be one of: low, medium, high, urgent'
    }),
    labels: joi.array().items(joi.object({
      name: joi.string().trim().max(50).required(),
      color: joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required()
    })),
    estimatedHours: joi.number().min(0).max(1000).allow(null).messages({
      'number.min': 'Estimated hours cannot be negative',
      'number.max': 'Estimated hours cannot exceed 1000'
    }),
    actualHours: joi.number().min(0).max(1000).allow(null).messages({
      'number.min': 'Actual hours cannot be negative',
      'number.max': 'Actual hours cannot exceed 1000'
    }),
    startDate: joi.date().allow(null)
  }),
  
  move: joi.object({
    listId: joi.string().required().messages({
      'any.required': 'List ID is required'
    }),
    position: joi.number().min(0).required().messages({
      'number.min': 'Position cannot be negative',
      'any.required': 'Position is required'
    })
  }),
  
  addComment: joi.object({
    text: joi.string().trim().min(1).max(1000).required().messages({
      'string.min': 'Comment cannot be empty',
      'string.max': 'Comment cannot exceed 1000 characters',
      'any.required': 'Comment text is required'
    })
  })
};

// Validation middleware factory
const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

// Validation helpers
const validateBoard = {
  create: createValidationMiddleware(boardValidationSchemas.create),
  update: createValidationMiddleware(boardValidationSchemas.update),
  addMember: createValidationMiddleware(boardValidationSchemas.addMember)
};

const validateList = {
  create: createValidationMiddleware(listValidationSchemas.create),
  update: createValidationMiddleware(listValidationSchemas.update),
  reorder: createValidationMiddleware(listValidationSchemas.reorder)
};

const validateCard = {
  create: createValidationMiddleware(cardValidationSchemas.create),
  update: createValidationMiddleware(cardValidationSchemas.update),
  move: createValidationMiddleware(cardValidationSchemas.move),
  addComment: createValidationMiddleware(cardValidationSchemas.addComment)
};

const handleValidationErrors = (req, res, next) => {
  next();
};

module.exports = {
  authValidationSchemas,
  boardValidationSchemas,
  listValidationSchemas,
  cardValidationSchemas,
  validate,
  validateBoard,
  validateList,
  validateCard,
  handleValidationErrors
};