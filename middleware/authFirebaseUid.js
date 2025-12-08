// backend/middleware/authFirebaseUid.js
const AppUser = require("../models/AppUser");

const authFirebaseUid = (req, res, next) => {
  console.log('🔍 authFirebaseUid middleware called');
  
  // Try multiple header names
  const firebaseUid = req.headers.firebaseuid || 
                      req.headers['firebase-uid'] || 
                      req.headers['x-firebase-uid'] ||
                      req.headers.authorization?.split(' ')[1]; // Could be in Bearer token
  
  console.log('Headers received:', {
    firebaseuid: req.headers.firebaseuid,
    'firebase-uid': req.headers['firebase-uid'],
    'x-firebase-uid': req.headers['x-firebase-uid'],
    authorization: req.headers.authorization ? 'Present' : 'Missing'
  });
  
  if (!firebaseUid) {
    console.log('⚠️ No firebaseUid found in headers - allowing with demo user');
    
    // For recommendations, we can proceed with demo user
    // Or check if this is a public endpoint that should work without auth
    req.firebaseUid = 'demo-user';
    req.isDemoUser = true;
    
    // Don't return 400 - just proceed with demo user
    // return res.status(400).json({ message: "firebaseUid header missing" });
    
    return next();
  }
  
  req.firebaseUid = firebaseUid;
  req.isDemoUser = false;
  console.log(`✅ Firebase UID set: ${firebaseUid}`);
  next();
};

const getUserByFirebaseUid = async (firebaseUid) => {
  // Skip database lookup for demo user
  if (firebaseUid === 'demo-user') {
    return {
      _id: 'demo-user-id',
      firebaseUid: 'demo-user',
      email: 'demo@example.com',
      favoriteGenres: ['Fiction', 'Fantasy', 'Mystery'],
      readingHistory: []
    };
  }
  
  return await AppUser.findOne({ firebaseUid });
};

module.exports = { authFirebaseUid, getUserByFirebaseUid };