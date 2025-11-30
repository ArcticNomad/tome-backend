// backend/routes/users.js
const express = require('express');
const { verifyFirebaseToken } = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

// Get user profile
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update reading progress
router.post('/reading-progress', verifyFirebaseToken, async (req, res) => {
  try {
    const { bookId, gutenbergId, progress, currentPage } = req.body;
    
    const user = await User.findOne({ firebaseUid: req.user.uid });
    
    const existingProgress = user.readingHistory.find(
      item => item.gutenbergId === gutenbergId
    );
    
    if (existingProgress) {
      existingProgress.progress = progress;
      existingProgress.currentPage = currentPage;
      existingProgress.lastRead = new Date();
    } else {
      user.readingHistory.push({
        bookId,
        gutenbergId,
        progress,
        currentPage,
        lastRead: new Date()
      });
    }
    
    await user.save();
    res.json({ message: 'Progress updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add bookmark
router.post('/bookmarks', verifyFirebaseToken, async (req, res) => {
  try {
    const { bookId, gutenbergId, notes } = req.body;
    
    const user = await User.findOne({ firebaseUid: req.user.uid });
    
    user.bookmarks.push({
      bookId,
      gutenbergId,
      notes,
      createdAt: new Date()
    });
    
    await user.save();
    res.json({ message: 'Bookmark added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;