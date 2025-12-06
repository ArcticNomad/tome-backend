// backend/routes/reviewRoutes.js
const express = require('express');
const { verifyFirebaseToken } = require('../middleware/authMiddleware');
const {
  getBookReviews,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
  getUserReviews
} = require('../controllers/reviewController');

const router = express.Router();

// Public routes
router.get('/book/:bookId', getBookReviews);

// Protected routes (require authentication)
router.post('/book/:bookId', verifyFirebaseToken, createReview);
router.put('/:reviewId', verifyFirebaseToken, updateReview);
router.delete('/:reviewId', verifyFirebaseToken, deleteReview);
router.post('/:reviewId/helpful', verifyFirebaseToken, markHelpful);
router.get('/user/mine', verifyFirebaseToken, getUserReviews);

module.exports = router;