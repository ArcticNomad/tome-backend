// backend/middleware/authMiddleware.js
const admin = require('../config/firebaseAdmin');
const AppUser = require("../models/AppUser");

const verifyFirebaseToken = async (req, res, next) => {
  try {
    // If Firebase admin is not initialized, skip auth
    if (!admin) {
      console.log('⚠️ Firebase Admin not available - skipping auth');
      req.user = { 
        uid: 'demo-user', 
        email: 'demo@example.com',
        firebaseUid: 'demo-user'
      };
      req.firebaseUid = 'demo-user';
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('⚠️ No token provided - using demo user');
      req.user = { 
        uid: 'demo-user', 
        email: 'demo@example.com',
        firebaseUid: 'demo-user'
      };
      req.firebaseUid = 'demo-user';
      return next();
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    req.firebaseUid = decodedToken.uid;
    
    // Try to find or create AppUser
    try {
      let appUser = await AppUser.findOne({ firebaseUid: decodedToken.uid });
      if (!appUser) {
        appUser = new AppUser({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          displayName: decodedToken.name || '',
          photoURL: decodedToken.picture || '',
          createdAt: new Date()
        });
        await appUser.save();
        console.log(`✅ Created new AppUser for ${decodedToken.uid}`);
      }
      req.appUser = appUser;
    } catch (dbError) {
      console.error('❌ Error accessing AppUser database:', dbError.message);
    }
    
    console.log(`✅ Authenticated user: ${decodedToken.email || decodedToken.uid}`);
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    
    // For development, allow demo user
    console.log('⚠️ Using demo user due to auth error');
    req.user = { 
      uid: 'demo-user', 
      email: 'demo@example.com',
      firebaseUid: 'demo-user'
    };
    req.firebaseUid = 'demo-user';
    next();
  }
};

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