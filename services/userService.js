const User = require('../models/User'); // Change from AppUser to User

const getUserByFirebaseUid = async (firebaseUid) => {
  try {
    if (!firebaseUid) return null;
    
    const user = await User.findOne({ firebaseUid })
      .select('readingPreferences favoriteGenres displayName email');
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

module.exports = { getUserByFirebaseUid };