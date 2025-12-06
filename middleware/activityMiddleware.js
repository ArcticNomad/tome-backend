// backend/middleware/activityMiddleware.js
const User = require('../models/User');

const trackDailyActivity = async (req, res, next) => {
  try {
    if (req.user && req.user.uid) {
      const user = await User.findOne({ firebaseUid: req.user.uid });
      if (user) {
        // Update last active timestamp
        user.lastActive = new Date();
        await user.save();
      }
    }
    next();
  } catch (error) {
    console.error('Activity tracking error:', error);
    next(); // Don't block the request if tracking fails
  }
};

module.exports = { trackDailyActivity };