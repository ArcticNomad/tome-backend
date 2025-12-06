// backend/models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  bookId: {
    type: String, // Changed from ObjectId to String to store gutenbergId
    required: true
  },
  userId: {
    type: String, // Firebase UID
    required: true
  },
  userEmail: String,
  userName: String,
  userAvatar: String,
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: String,
  content: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 1000
  },
  likes: {
    type: Number,
    default: 0
  },
  helpful: [String],
  verifiedPurchase: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the index to use String bookId
reviewSchema.index({ bookId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);