// backend/routes/books.js
const express = require('express');
const {
  getAllBooks,
  getRecentlyAdded,
  getPopularBooks,
  getFantasyBooks,
  getFeaturedBooks,
  getBooksByGenre,
  getHighlyReviewedBooks,
  getHomepageStats
} = require('../controllers/bookController');

const router = express.Router();

// Public routes for homepage
router.get('/', getAllBooks);
router.get('/recent', getRecentlyAdded);
router.get('/popular', getPopularBooks);
router.get('/fantasy', getFantasyBooks);
router.get('/featured', getFeaturedBooks);
router.get('/genre/:genre', getBooksByGenre);
router.get('/community/reviews', getHighlyReviewedBooks);
router.get('/stats/homepage', getHomepageStats);

module.exports = router;