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
  getHomepageStats,
  getBookById,
  getRelatedBooks,
  getBooksWithPagination,
  getBookWithFullText,
  getFullTextUrl,
  getBookContent
} = require('../controllers/bookController');

const { getRecommendations } = require("../controllers/recommendController");
const { authFirebaseUid } = require("../middleware/authFirebaseUid");
const { getBecauseYouLiked } = require("../controllers/becauseYouLikedController");

const router = express.Router();

// ========== SPECIFIC ROUTES FIRST ==========
// These need to come BEFORE the /:id route!

// Recommendation routes (require auth)
router.get('/similar-recommendations', authFirebaseUid, getRecommendations);
router.get('/because-you-liked', authFirebaseUid, getBecauseYouLiked);

// ========== GENERAL ROUTES ==========
router.get('/', getAllBooks);
router.get('/paginated', getBooksWithPagination);
router.get('/recent', getRecentlyAdded);
router.get('/popular', getPopularBooks);
router.get('/fantasy', getFantasyBooks);
router.get('/featured', getFeaturedBooks);
router.get('/genre/:genre', getBooksByGenre);
router.get('/community/reviews', getHighlyReviewedBooks);
router.get('/stats/homepage', getHomepageStats);

// ========== BOOK DETAIL ROUTES ==========
// These come LAST because they use wildcards (:id)
router.get('/:id/full', getBookWithFullText);
router.get('/:id/text-url', getFullTextUrl);
router.get('/:id/content', getBookContent);
router.get('/:id/related', getRelatedBooks);
router.get('/:id', getBookById); // THIS MUST BE LAST!

module.exports = router;