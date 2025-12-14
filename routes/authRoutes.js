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
      
      user.lastLogin = new Date();
      await user.save();
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// backend/routes/authRoutes.js - ADD THIS ROUTE
const admin = require('firebase-admin');

// PUBLIC route to create Firebase user (no auth required)
router.post('/auth/create-firebase-user', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    console.log('📝 Creating Firebase user for:', email);

    // Create user using Firebase Admin SDK
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName || email.split('@')[0],
      emailVerified: false,
      disabled: false,
    });

    console.log('✅ Firebase user created:', userRecord.uid);

    res.json({
      success: true,
      message: 'Firebase user created successfully',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      }
    });

  } catch (error) {
    console.error('❌ Firebase user creation error:', error);
    
    let errorMessage = 'Failed to create user';
    let statusCode = 500;

    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Email already exists';
      statusCode = 409;
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
      statusCode = 400;
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
});

module.exports = router;