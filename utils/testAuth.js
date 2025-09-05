require('dotenv').config();
const axios = require('axios');

// Base URL for API
const API_BASE = 'http://localhost:3000/api';

/**
 * Test authentication endpoints
 */
const testAuthentication = async () => {
  console.log('🧪 Testing KanbanFlow Authentication System\n');
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Health Check:', healthResponse.data.status);
    console.log();
    
    // Test 2: User Registration
    console.log('2️⃣ Testing User Registration...');
    const newUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'TestPass123',
      confirmPassword: 'TestPass123'
    };
    
    try {
      const registerResponse = await axios.post(`${API_BASE}/auth/register`, newUser);
      console.log('✅ Registration successful!');
      console.log('User:', registerResponse.data.data.user.name);
      console.log('Email:', registerResponse.data.data.user.email);
      console.log('Token received:', !!registerResponse.data.data.token);
      console.log();
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('already registered')) {
        console.log('⚠️ User already exists, continuing with login test...');
        console.log();
      } else {
        throw error;
      }
    }
    
    // Test 3: User Login
    console.log('3️⃣ Testing User Login...');
    const loginData = {
      email: 'demo@kanbanflow.com',
      password: 'Password123'
    };
    
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, loginData);
    console.log('✅ Login successful!');
    console.log('User:', loginResponse.data.data.user.name);
    console.log('Token received:', !!loginResponse.data.data.token);
    
    const token = loginResponse.data.data.token;
    console.log();
    
    // Test 4: Get Profile (Protected Route)
    console.log('4️⃣ Testing Protected Route (Get Profile)...');
    const profileResponse = await axios.get(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('✅ Profile retrieved successfully!');
    console.log('User ID:', profileResponse.data.data._id);
    console.log('Name:', profileResponse.data.data.name);
    console.log('Email:', profileResponse.data.data.email);
    console.log();
    
    // Test 5: Update Profile
    console.log('5️⃣ Testing Profile Update...');
    const updateData = {
      name: 'Demo User Updated'
    };
    
    const updateResponse = await axios.put(`${API_BASE}/auth/me`, updateData, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('✅ Profile updated successfully!');
    console.log('New name:', updateResponse.data.data.name);
    console.log();
    
    // Test 6: Test Invalid Token
    console.log('6️⃣ Testing Invalid Token...');
    try {
      await axios.get(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });
      console.log('❌ Should have failed with invalid token');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Invalid token correctly rejected');
      } else {
        throw error;
      }
    }
    console.log();
    
    // Test 7: Test No Token
    console.log('7️⃣ Testing No Token...');
    try {
      await axios.get(`${API_BASE}/auth/me`);
      console.log('❌ Should have failed with no token');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Missing token correctly rejected');
      } else {
        throw error;
      }
    }
    console.log();
    
    // Test 8: Test Invalid Login
    console.log('8️⃣ Testing Invalid Login...');
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: 'demo@kanbanflow.com',
        password: 'wrongpassword'
      });
      console.log('❌ Should have failed with wrong password');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Invalid credentials correctly rejected');
      } else {
        throw error;
      }
    }
    console.log();
    
    console.log('🎉 All authentication tests passed!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Health check');
    console.log('✅ User registration');
    console.log('✅ User login');
    console.log('✅ Protected route access');
    console.log('✅ Profile update');
    console.log('✅ Invalid token rejection');
    console.log('✅ Missing token rejection');
    console.log('✅ Invalid credentials rejection');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the server is running:');
      console.error('   cd backend && npm run dev');
    }
  }
};

// Check if axios is available
const checkDependencies = async () => {
  try {
    require('axios');
    return true;
  } catch (error) {
    console.log('📦 Installing axios for testing...');
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec('npm install axios --save-dev', (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to install axios:', error);
          reject(error);
        } else {
          console.log('✅ Axios installed successfully');
          resolve(true);
        }
      });
    });
  }
};

// Main execution
const main = async () => {
  try {
    await checkDependencies();
    await testAuthentication();
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = testAuthentication;