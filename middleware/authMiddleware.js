// backend/middleware/authMiddleware.js
const admin = require('../config/firebaseAdmin');
const User = require('../models/User');

const verifyFirebaseToken = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called');
    console.log('Headers:', {
      authorization: req.headers.authorization?.substring(0, 50) + '...'
    });

    // If no Firebase admin, skip auth for testing
    if (!admin) {
      console.log('⚠️ Firebase Admin not available - skipping auth');
      req.user = {
        uid: 'demo-user-' + Date.now(),
        email: 'demo@example.com',
        name: 'Demo User'
      };
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('❌ No token provided');
      req.user = null;
      return next();
    }

    console.log('🔑 Verifying token...');
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    console.log('✅ Token verified for user:', decodedToken.uid);
    console.log('User email:', decodedToken.email);
    
    // Set req.user with the decoded token data
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || '',
      picture: decodedToken.picture || ''
    };
    
    // Also set firebaseUid for compatibility
    req.firebaseUid = decodedToken.uid;
    
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    console.error('Error stack:', error.stack);
    
    // For development, allow demo user
    console.log('⚠️ Using demo user due to auth error');
    req.user = {
      uid: 'demo-user-' + Date.now(),
      email: 'demo@example.com',
      name: 'Demo User'
    };
    next();
  }
};

module.exports = { verifyFirebaseToken };