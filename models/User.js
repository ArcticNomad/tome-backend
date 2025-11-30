// backend/models/User.js
const mongoose = require('mongoose');

const readingProgressSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  gutenbergId: Number,
  currentPage: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastRead: {
    type: Date,
    default: Date.now
  },
  isFinished: {
    type: Boolean,
    default: false
  },
  readingTime: { // in minutes
    type: Number,
    default: 0
  }
});

const bookmarkSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  gutenbergId: Number,
  pageNumber: Number,
  note: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  preferences: {
    theme: { type: String, default: 'light' },
    fontSize: { type: String, default: 'medium' },
    language: { type: String, default: 'en' },
    readingSpeed: { type: Number, default: 200 } // words per minute
  },
  readingHistory: [readingProgressSchema],
  bookmarks: [bookmarkSchema],
  favoriteBooks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

// Index for better performance

module.exports = mongoose.model('User', userSchema);