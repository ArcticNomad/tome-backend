// backend/middleware/authMiddleware.js
const admin = require('../config/firebaseAdmin');
const User = require("../models/User"); 

const verifyFirebaseToken = async (req, res, next) => {
  try {
    // If Firebase admin is not initialized, skip auth
    if (!admin) {
      console.log('⚠️ Firebase Admin not available - skipping auth');
      req.firebaseUid = 'demo-user';
      req.isAuthenticated = false;
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('⚠️ No token provided');
      req.firebaseUid = null;
      req.isAuthenticated = false;
      return next();
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find existing user in DB
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (user) {
      req.user = user;
      req.firebaseUid = user.firebaseUid;
      req.isAuthenticated = true;
      console.log(`✅ Authenticated existing user: ${user.email || user.firebaseUid}`);
    } else {
      // User doesn't exist yet (hasn't completed signup)
      req.firebaseUid = decodedToken.uid;
      req.isAuthenticated = false; // Not fully registered
      console.log(`⚠️ User authenticated but not registered in DB: ${decodedToken.uid}`);
    }
    
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    
    // For development only
    req.firebaseUid = 'demo-user';
    req.isAuthenticated = false;
    next();
  }
};

module.exports = { verifyFirebaseToken };

const authFirebaseUid = (req, res, next) => {
  const firebaseUid = req.headers.firebaseuid || req.user?.uid;
  
  if (!firebaseUid) {
    console.log('⚠️ No firebaseUid found in headers or user - using demo');
    req.firebaseUid = 'demo-user';
  } else {
    req.firebaseUid = firebaseUid;
  }
  next();
};

const getUserByFirebaseUid = async (firebaseUid) => {
  return await AppUser.findOne({ firebaseUid });
};

module.exports = { 
  verifyFirebaseToken, 
  authFirebaseUid, 
  getUserByFirebaseUid 
};