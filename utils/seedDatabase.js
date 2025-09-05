require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Board = require('../models/Board');
const List = require('../models/List');
const Card = require('../models/Card');

/**
 * Seed database with comprehensive sample data for development
 */
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting comprehensive database seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    await Card.deleteMany({});
    await List.deleteMany({});
    await Board.deleteMany({});
    await User.deleteMany({});
    console.log('🗑️ Cleared existing data');
    
    // Create sample users
    const users = [
      {
        name: 'Demo User',
        email: 'demo@kanbanflow.com',
        password: 'Password123'
      },
      {
        name: 'Alex Startup',
        email: 'alex@startup.com',
        password: 'Password123'
      },
      {
        name: 'Priya Manager',
        email: 'priya@company.com',
        password: 'Password123'
      },
      {
        name: 'David Designer',
        email: 'david@freelance.com',
        password: 'Password123'
      },
      {
        name: 'Admin User',
        email: 'admin@kanbanflow.com',
        password: 'AdminPass123',
        role: 'admin'
      }
    ];
    
    // Create users one by one to trigger password hashing
    const createdUsers = [];
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }
    
    console.log(`👥 Created ${createdUsers.length} sample users`);
    
    // Create sample boards
    const boardsData = [
      {
        name: 'Web Development Project',
        description: 'Full-stack web application development using MEAN stack',
        ownerId: createdUsers[0]._id,
        members: [createdUsers[1]._id, createdUsers[2]._id],
        backgroundColor: '#0079bf',
        isPublic: false
      },
      {
        name: 'Marketing Campaign',
        description: 'Q4 2024 Product Launch Marketing Campaign',
        ownerId: createdUsers[1]._id,
        members: [createdUsers[0]._id, createdUsers[3]._id],
        backgroundColor: '#d29034',
        isPublic: true
      },
      {
        name: 'Design System',
        description: 'Company-wide design system and component library',
        ownerId: createdUsers[3]._id,
        members: [createdUsers[0]._id, createdUsers[2]._id],
        backgroundColor: '#519839',
        isPublic: false
      },
      {
        name: 'Personal Tasks',
        description: 'Personal productivity and task management',
        ownerId: createdUsers[0]._id,
        members: [],
        backgroundColor: '#b04632',
        isPublic: false
      }
    ];
    
    const createdBoards = [];
    for (const boardData of boardsData) {
      const board = new Board(boardData);
      await board.save();
      createdBoards.push(board);
    }
    
    console.log(`📋 Created ${createdBoards.length} sample boards`);
    
    // Create sample lists for each board
    const listsData = [
      // Web Development Project lists
      [
        { name: 'Backlog', boardId: createdBoards[0]._id, position: 0 },
        { name: 'To Do', boardId: createdBoards[0]._id, position: 1 },
        { name: 'In Progress', boardId: createdBoards[0]._id, position: 2, wipLimit: 3 },
        { name: 'Code Review', boardId: createdBoards[0]._id, position: 3 },
        { name: 'Testing', boardId: createdBoards[0]._id, position: 4 },
        { name: 'Done', boardId: createdBoards[0]._id, position: 5 }
      ],
      // Marketing Campaign lists
      [
        { name: 'Ideas', boardId: createdBoards[1]._id, position: 0 },
        { name: 'Planning', boardId: createdBoards[1]._id, position: 1 },
        { name: 'In Progress', boardId: createdBoards[1]._id, position: 2 },
        { name: 'Review', boardId: createdBoards[1]._id, position: 3 },
        { name: 'Completed', boardId: createdBoards[1]._id, position: 4 }
      ],
      // Design System lists
      [
        { name: 'Research', boardId: createdBoards[2]._id, position: 0 },
        { name: 'Design', boardId: createdBoards[2]._id, position: 1 },
        { name: 'Development', boardId: createdBoards[2]._id, position: 2 },
        { name: 'Documentation', boardId: createdBoards[2]._id, position: 3 },
        { name: 'Published', boardId: createdBoards[2]._id, position: 4 }
      ],
      // Personal Tasks lists
      [
        { name: 'Today', boardId: createdBoards[3]._id, position: 0, cardLimit: 5 },
        { name: 'This Week', boardId: createdBoards[3]._id, position: 1 },
        { name: 'Later', boardId: createdBoards[3]._id, position: 2 },
        { name: 'Completed', boardId: createdBoards[3]._id, position: 3 }
      ]
    ];
    
    const createdLists = [];
    for (const boardLists of listsData) {
      for (const listData of boardLists) {
        const list = new List(listData);
        await list.save();
        createdLists.push(list);
      }
    }
    
    console.log(`📝 Created ${createdLists.length} sample lists`);
    
    // Create sample cards
    const cardsData = [
      // Web Development Project cards
      {
        title: 'Set up project repository',
        description: 'Initialize Git repository with proper folder structure and README',
        listId: createdLists[5]._id, // Done
        boardId: createdBoards[0]._id,
        position: 0,
        assignedTo: [createdUsers[0]._id],
        priority: 'high',
        completed: true,
        completedBy: createdUsers[0]._id,
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        labels: [
          { name: 'Setup', color: '#61bd4f' },
          { name: 'Backend', color: '#f2d600' }
        ]
      },
      {
        title: 'Design database schema',
        description: 'Create MongoDB schemas for users, boards, lists, and cards with proper relationships',
        listId: createdLists[2]._id, // In Progress
        boardId: createdBoards[0]._id,
        position: 0,
        assignedTo: [createdUsers[0]._id, createdUsers[2]._id],
        priority: 'high',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        estimatedHours: 16,
        actualHours: 12,
        labels: [
          { name: 'Database', color: '#c377e0' },
          { name: 'Backend', color: '#f2d600' }
        ],
        comments: [
          {
            userId: createdUsers[0]._id,
            text: 'Started working on the User and Board models. Need to define relationships between entities.',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
          },
          {
            userId: createdUsers[2]._id,
            text: 'Should we add indexing for performance? Especially on foreign keys.',
            createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
          }
        ]
      },
      {
        title: 'Implement user authentication',
        description: 'Build JWT-based authentication system with login, registration, and password reset functionality',
        listId: createdLists[1]._id, // To Do
        boardId: createdBoards[0]._id,
        position: 0,
        assignedTo: [createdUsers[1]._id],
        priority: 'high',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        estimatedHours: 24,
        labels: [
          { name: 'Authentication', color: '#ff9f1a' },
          { name: 'Security', color: '#eb5a46' },
          { name: 'Backend', color: '#f2d600' }
        ]
      },
      {
        title: 'Create drag and drop interface',
        description: 'Implement smooth drag and drop functionality for cards and lists using Angular CDK',
        listId: createdLists[0]._id, // Backlog
        boardId: createdBoards[0]._id,
        position: 0,
        assignedTo: [createdUsers[3]._id],
        priority: 'medium',
        estimatedHours: 20,
        labels: [
          { name: 'Frontend', color: '#0079bf' },
          { name: 'UX', color: '#c377e0' }
        ]
      },
      // Marketing Campaign cards
      {
        title: 'Social media content calendar',
        description: 'Create a comprehensive content calendar for all social media platforms for Q4 launch',
        listId: createdLists[7]._id, // Planning (Marketing board)
        boardId: createdBoards[1]._id,
        position: 0,
        assignedTo: [createdUsers[1]._id],
        priority: 'high',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        estimatedHours: 12,
        labels: [
          { name: 'Social Media', color: '#0079bf' },
          { name: 'Content', color: '#61bd4f' }
        ]
      },
      {
        title: 'Email campaign design',
        description: 'Design email templates for the product launch announcement campaign',
        listId: createdLists[8]._id, // In Progress (Marketing board)
        boardId: createdBoards[1]._id,
        position: 0,
        assignedTo: [createdUsers[3]._id],
        priority: 'medium',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        estimatedHours: 8,
        actualHours: 4,
        labels: [
          { name: 'Email', color: '#f2d600' },
          { name: 'Design', color: '#c377e0' }
        ]
      },
      // Personal Tasks cards
      {
        title: 'Review KanbanFlow PRD',
        description: 'Go through the product requirements document and provide feedback',
        listId: createdLists[16]._id, // Today (Personal board)
        boardId: createdBoards[3]._id,
        position: 0,
        assignedTo: [createdUsers[0]._id],
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        estimatedHours: 2,
        labels: [
          { name: 'Review', color: '#0079bf' }
        ]
      },
      {
        title: 'Update portfolio website',
        description: 'Add latest projects and update the design to reflect current skills',
        listId: createdLists[17]._id, // This Week (Personal board)
        boardId: createdBoards[3]._id,
        position: 0,
        assignedTo: [createdUsers[0]._id],
        priority: 'medium',
        estimatedHours: 6,
        labels: [
          { name: 'Personal', color: '#61bd4f' },
          { name: 'Website', color: '#0079bf' }
        ]
      }
    ];
    
    // Create cards with proper error handling
    const createdCards = [];
    for (const cardData of cardsData) {
      try {
        const card = new Card(cardData);
        await card.save();
        createdCards.push(card);
      } catch (error) {
        console.error('Error creating card:', cardData.title, error.message);
      }
    }
    
    console.log(`🎴 Created ${createdCards.length} sample cards`);
    
    // Add some checklist items to cards
    if (createdCards.length > 1) {
      const cardWithChecklist = createdCards[1]; // Database schema card
      cardWithChecklist.checklist = [
        { text: 'Create User model', completed: true, position: 0 },
        { text: 'Create Board model', completed: true, position: 1 },
        { text: 'Create List model', completed: false, position: 2 },
        { text: 'Create Card model', completed: false, position: 3 },
        { text: 'Add proper indexing', completed: false, position: 4 },
        { text: 'Test relationships', completed: false, position: 5 }
      ];
      await cardWithChecklist.save();
      console.log('✅ Added checklist items to sample card');
    }
    
    console.log('\n🎉 Database seeding completed successfully!');
    
    // Display summary
    console.log('\n📊 Sample Data Summary:');
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│                     SAMPLE ACCOUNTS                        │');
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ Email                    │ Password      │ Role           │');
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ demo@kanbanflow.com      │ Password123   │ user           │');
    console.log('│ alex@startup.com         │ Password123   │ user           │');
    console.log('│ priya@company.com        │ Password123   │ user           │');
    console.log('│ david@freelance.com      │ Password123   │ user           │');
    console.log('│ admin@kanbanflow.com     │ AdminPass123  │ admin          │');
    console.log('└────────────────────────────────────────────────────────────┘');
    
    console.log('\n📋 Sample Boards Created:');
    createdBoards.forEach((board, index) => {
      console.log(`   ${index + 1}. ${board.name} (${board.isPublic ? 'Public' : 'Private'})`);
    });
    
    console.log('\n🚀 Ready to test! Try these endpoints:');
    console.log('   POST http://localhost:3000/api/auth/login');
    console.log('   GET  http://localhost:3000/api/boards');
    console.log('   GET  http://localhost:3000/api/cards/my-cards');
    
    console.log('\n🧪 Run comprehensive API tests:');
    console.log('   npm run test:api');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;