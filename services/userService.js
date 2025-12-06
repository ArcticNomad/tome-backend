// backend/services/userService.js
const AppUser = require('../models/AppUser');

const getUserByFirebaseUid = async (firebaseUid) => {
  try {
    if (!firebaseUid) return null;
    
    const user = await AppUser.findOne({ firebaseUid });
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

module.exports = { getUserByFirebaseUid };