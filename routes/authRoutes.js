// backend/routes/authRoutes.js
const express = require('express');
const { verifyFirebaseToken } = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

// Sync user data after Firebase auth
router.post('/sync-user', verifyFirebaseToken, async (req, res) => {
  try {
    const { displayName, email } = req.user;
    
    let user = await User.findOne({ firebaseUid: req.user.uid });
    
    if (!user) {
      // Create new user in MongoDB
      user = new User({
        firebaseUid: req.user.uid,
        email: email,
        displayName: displayName || email.split('@')[0]
      });
      await user.save();
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;