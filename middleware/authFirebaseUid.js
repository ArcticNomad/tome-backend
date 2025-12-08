// backend/middleware/authFirebaseUid.js
const User = require('../models/User');

const authFirebaseUid = async (req, res, next) => {
  console.log('🔍 authFirebaseUid middleware called');
  
  try {
    // Check multiple header locations
    const firebaseUid = req.headers.firebaseuid || 
                      req.headers['firebase-uid'] ||
                      req.headers['x-firebase-uid'] ||
                      req.query.firebaseuid ||
                      (req.user && req.user.uid);
    
    console.log('Headers checked:', {
      firebaseuid: req.headers.firebaseuid,
      'firebase-uid': req.headers['firebase-uid'],
      'x-firebase-uid': req.headers['x-firebase-uid'],
      userUid: req.user && req.user.uid
    });
    
    if (!firebaseUid) {
      console.log('⚠️ No firebaseUid found - allowing with demo user');
      req.firebaseUid = 'demo-user';
      req.isAuthenticated = false;
      req.userData = null;
      return next();
    }
    
    // Fetch user from MongoDB
    const user = await User.findOne({ firebaseUid })
      .select('readingPreferences favoriteGenres displayName email firebaseUid');
    
    if (user) {
      console.log(`✅ User found in MongoDB: ${user.displayName || user.email}`);
      req.userData = user;
      req.isAuthenticated = true;
    } else {
      console.log('⚠️ User not found in MongoDB');
      req.isAuthenticated = false;
      req.userData = null;
    }
    
    req.firebaseUid = firebaseUid;
    console.log(`✅ Firebase UID set: ${firebaseUid}, Authenticated: ${req.isAuthenticated}`);
    
    next();
  } catch (error) {
    console.error('❌ Error in authFirebaseUid middleware:', error);
    req.firebaseUid = 'demo-user';
    req.isAuthenticated = false;
    req.userData = null;
    next();
  }
};

module.exports = { authFirebaseUid };