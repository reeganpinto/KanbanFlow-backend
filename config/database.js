const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kanbanflow';
    
    const options = {
      // Connection options for better performance and reliability
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
    };

    await mongoose.connect(mongoURI, options);
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📍 Connected to: ${mongoURI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during MongoDB disconnection:', error);
        process.exit(1);
      }
    });
    
    process.on('SIGTERM', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed through SIGTERM');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during MongoDB disconnection:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // Detailed error logging in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error details:', error);
    }
    
    process.exit(1);
  }
};

// Connection state checker
const getConnectionState = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    state: states[mongoose.connection.readyState],
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

// Health check for database
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDB,
  getConnectionState,
  isConnected,
  mongoose
};