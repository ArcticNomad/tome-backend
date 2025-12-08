// backend/middleware/activityMiddleware.js
const trackDailyActivity = async (req, res, next) => {
  try {
    console.log('🏃‍♂️ Activity middleware called');
    console.log('req.user in activity middleware:', req.user);
    console.log('req.firebaseUid in activity middleware:', req.firebaseUid);
    
    // If no user, skip tracking but continue
    if (!req.user && !req.firebaseUid) {
      console.log('⚠️ No user found for activity tracking');
      return next();
    }
    
    // Get firebaseUid from either req.user or req.firebaseUid
    const firebaseUid = req.user?.uid || req.firebaseUid;
    
    if (!firebaseUid) {
      console.log('⚠️ No firebaseUid found for activity tracking');
      return next();
    }
    
    console.log(`📊 Tracking activity for user: ${firebaseUid}`);
    
    // Find user and update activity
    const User = require('../models/User');
    const user = await User.findOne({ firebaseUid });
    
    if (user) {
      await user.updateReadingActivity();
      console.log(`✅ Activity tracked for ${user.email || firebaseUid}`);
    } else {
      console.log(`⚠️ User ${firebaseUid} not found in database for activity tracking`);
    }
    
    next();
  } catch (error) {
    console.error('❌ Activity tracking error:', error);
    // Don't fail the request if activity tracking fails
    next();
  }
};

module.exports = { trackDailyActivity };