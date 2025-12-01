// backend/routes/users.js
const express = require('express');
const { verifyFirebaseToken } = require('../middleware/authMiddleware');
const {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  addToBookshelf,
  removeFromBookshelf,
  getBookshelf,
  updateReadingProgress,
  getReadingHistory,
  toggleFavoriteBook,
  getFavoriteBooks,
  getUserStatistics,
  addBookmark,
  getBookmarks,
  getBookStatus

} = require('../controllers/userController');

const router = express.Router();

router.get('/books/:bookId/status', verifyFirebaseToken, getBookStatus);

router.get('/test', (req, res) => {
  console.log('✅ Test route hit!');
  res.json({ message: 'User routes are working!' });
});

router.post('/profile/create-test', (req, res) => {
  console.log('✅ Profile create test route hit!');
  console.log('Body:', req.body);
  res.json({ 
    success: true, 
    message: 'Profile create route works without auth',
    body: req.body 
  });
});

// ========== PROFILE ROUTES ==========
router.post('/profile/create', verifyFirebaseToken, createUserProfile); // Create profile after signup
router.get('/profile', verifyFirebaseToken, getUserProfile); // Get full profile
router.put('/profile', verifyFirebaseToken, updateUserProfile); // Update profile

// ========== BOOKSHELF ROUTES ==========
router.post('/bookshelves', verifyFirebaseToken, addToBookshelf); // Add to bookshelf
router.delete('/bookshelves/:shelfType/:bookId', verifyFirebaseToken, removeFromBookshelf); // Remove from bookshelf
router.get('/bookshelves/:shelfType', verifyFirebaseToken, getBookshelf); // Get specific bookshelf

// ========== READING PROGRESS ROUTES ==========
router.post('/reading-progress', verifyFirebaseToken, updateReadingProgress); // Update progress
router.get('/reading-history', verifyFirebaseToken, getReadingHistory); // Get reading history

// ========== FAVORITES ROUTES ==========
router.post('/favorites/:bookId/toggle', verifyFirebaseToken, toggleFavoriteBook); // Toggle favorite
router.get('/favorites', verifyFirebaseToken, getFavoriteBooks); // Get favorite books

// ========== STATISTICS ROUTES ==========
router.get('/statistics', verifyFirebaseToken, getUserStatistics); // Get user stats

// ========== BOOKMARKS ROUTES ==========
router.post('/bookmarks', verifyFirebaseToken, addBookmark); // Add bookmark
router.get('/bookmarks', verifyFirebaseToken, getBookmarks); // Get bookmarks

module.exports = router;