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
  getBookStatus,
  checkAvailability
} = require('../controllers/userController');

const { trackDailyActivity } = require('../middleware/activityMiddleware');
const router = express.Router();

// PUBLIC ROUTES (no auth required)
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

router.get('/profile/check-availability', checkAvailability);

// ========== PROTECTED ROUTES ==========
// Apply both auth and activity tracking middleware
const protectedRoute = [verifyFirebaseToken, trackDailyActivity];

// ========== PROFILE ROUTES ==========
router.post('/profile/create', protectedRoute, createUserProfile);
router.get('/profile', protectedRoute, getUserProfile);
router.put('/profile', protectedRoute, updateUserProfile);

// ========== BOOKSHELF ROUTES ==========
router.post('/bookshelves', protectedRoute, addToBookshelf);
router.delete('/bookshelves/:shelfType/:bookId', protectedRoute, removeFromBookshelf);
router.get('/bookshelves/:shelfType', protectedRoute, getBookshelf);
router.get('/books/:bookId/status', protectedRoute, getBookStatus);

// ========== READING PROGRESS ROUTES ==========
router.post('/reading-progress', protectedRoute, updateReadingProgress);
router.get('/reading-history', protectedRoute, getReadingHistory);

// ========== FAVORITES ROUTES ==========
router.post('/favorites/:bookId/toggle', protectedRoute, toggleFavoriteBook);
router.get('/favorites', protectedRoute, getFavoriteBooks);

// ========== STATISTICS ROUTES ==========
router.get('/statistics', protectedRoute, getUserStatistics);

// ========== BOOKMARKS ROUTES ==========
router.post('/bookmarks', protectedRoute, addBookmark);
router.get('/bookmarks', protectedRoute, getBookmarks);

module.exports = router;