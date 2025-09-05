# KanbanFlow Backend

Node.js/Express.js REST API server with Socket.IO for real-time collaboration.

## 🚀 Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment setup**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
backend/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
├── models/           # MongoDB/Mongoose models
├── routes/           # Express routes
├── socket/           # Socket.IO event handlers
├── utils/            # Utility functions
├── uploads/          # File upload directory
├── server.js         # Main server file
└── package.json      # Dependencies and scripts
```

## 🔧 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Boards

- `GET /api/boards` - Get user's boards
- `POST /api/boards` - Create new board
- `GET /api/boards/:id` - Get specific board
- `PUT /api/boards/:id` - Update board
- `DELETE /api/boards/:id` - Delete board
- `POST /api/boards/:id/members` - Add member to board

### Lists

- `POST /api/lists` - Create new list
- `PUT /api/lists/:id` - Update list
- `DELETE /api/lists/:id` - Delete list
- `PUT /api/lists/:id/position` - Reorder list

### Cards

- `POST /api/cards` - Create new card
- `GET /api/cards/:id` - Get card details
- `PUT /api/cards/:id` - Update card
- `DELETE /api/cards/:id` - Delete card
- `PUT /api/cards/:id/position` - Move card
- `POST /api/cards/:id/comments` - Add comment
- `POST /api/cards/:id/attachments` - Add attachment

## 🔌 Socket.IO Events

### Client → Server

- `join-board` - Join board room for real-time updates
- `leave-board` - Leave board room

### Server → Client

- `card-moved` - Card position changed
- `card-updated` - Card details updated
- `list-updated` - List modified
- `board-updated` - Board modified
- `comment-added` - New comment added

## 🗄️ Database Models

### User

- `_id`, `name`, `email`, `password`, `avatarUrl`, `createdAt`, `updatedAt`

### Board

- `_id`, `name`, `ownerId`, `members[]`, `createdAt`, `updatedAt`

### List

- `_id`, `name`, `boardId`, `position`, `createdAt`, `updatedAt`

### Card

- `_id`, `title`, `description`, `listId`, `boardId`, `position`, `assignedTo[]`, `dueDate`, `attachments[]`, `comments[]`, `createdAt`, `updatedAt`

## 🛡️ Security Features

- JWT authentication
- Password hashing with bcrypt
- Request rate limiting
- CORS protection
- Helmet security headers
- Input validation and sanitization

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```
