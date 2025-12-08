// backend/services/userService.js - UPDATED
// Change from AppUser to User
const User = require('../models/User'); // Use the main User model

const getUserByFirebaseUid = async (firebaseUid) => {
  try {
    if (!firebaseUid || firebaseUid === 'demo-user') {
      console.log('👤 No valid user ID');
      return null;
    }
    
    console.log(`🔍 Looking for user with firebaseUid: ${firebaseUid} in USERS collection`);
    
    // Try to find user in the User collection (not AppUser)
    const user = await User.findOne({ firebaseUid });
    
    if (!user) {
      console.log(`❌ User ${firebaseUid} not found in User collection`);
      return null;
    }
    
    console.log(`✅ Found user: ${user.displayName || user.email} with favoriteGenres:`, 
                user.readingPreferences?.favoriteGenres || 'None');
    return user;
    
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    return null;
  }
};

module.exports = { getUserByFirebaseUid };