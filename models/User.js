// backend/models/User.js
const mongoose = require('mongoose');

// --- Sub-schemas ---

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

// NEW: Personal Details Schema
const personalDetailsSchema = new mongoose.Schema({
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say', ''],
    default: ''
  },
  birthDate: Date,
  location: {
    city: String,
    country: String
  },
  profilePicture: String, // URL to stored image
  bio: String // Short bio/introduction
});

// NEW: Reading Preferences Schema
const readingPreferencesSchema = new mongoose.Schema({
  favoriteGenres: [{
    type: String,
    enum: [
      'Romance', 'Mystery/Thriller', 'Fantasy', 'Science Fiction', 
      'Historical Fiction', 'Biography', 'Self-Help', 'Young Adult',
      'Horror', 'Literary Fiction', 'Poetry', 'Drama', 'Classics',
      'Non-fiction', 'Comedy', 'Adventure'
    ]
  }],
  readingGoal: {
    type: String,
    enum: ['casual', 'regular', 'avid'],
    default: 'casual'
  },
  readingFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'weekly'
  },
  favoriteBook: String,
  favoriteAuthor: String
});

// NEW: Reading Statistics Schema
const readingStatsSchema = new mongoose.Schema({
  booksRead: {
    type: Number,
    default: 0
  },
  readingStreak: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  totalReadingTime: { // in hours
    type: Number,
    default: 0
  },
  pagesRead: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewsWritten: {
    type: Number,
    default: 0
  },
  lastReadingDate: Date
});

// NEW: Bookshelves Schema
const bookshelvesSchema = new mongoose.Schema({
  currentlyReading: [{
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    gutenbergId: Number,
    startedAt: Date
  }],
  wantToRead: [{
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    gutenbergId: Number,
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    }
  }],
  read: [{
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book'
    },
    gutenbergId: Number,
    finishedAt: Date,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String
  }]
});

// NEW: Social Schema (simplified - no premium)
const socialSchema = new mongoose.Schema({
  friendsCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  followersCount: {
    type: Number,
    default: 0
  }
});

// --- Main User Schema ---
const userSchema = new mongoose.Schema({
  // Firebase Authentication
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  
  // NEW: Profile Information (from signup flow)
  personalDetails: {
    type: personalDetailsSchema,
    default: () => ({})
  },
  readingPreferences: {
    type: readingPreferencesSchema,
    default: () => ({})
  },
  readingStats: {
    type: readingStatsSchema,
    default: () => ({})
  },
  bookshelves: {
    type: bookshelvesSchema,
    default: () => ({
      currentlyReading: [],
      wantToRead: [],
      read: []
    })
  },
  social: {
    type: socialSchema,
    default: () => ({})
  },
  
  // Existing fields (keeping for backward compatibility)
  preferences: {
    theme: { 
      type: String, 
      enum: ['light', 'dark', 'auto'],
      default: 'light' 
    },
    fontSize: { 
      type: String, 
      enum: ['small', 'medium', 'large', 'x-large'],
      default: 'medium' 
    },
    language: { 
      type: String, 
      default: 'en' 
    },
    readingSpeed: { 
      type: Number, 
      min: 50,
      max: 1000,
      default: 200 
    }
  },
  
  // Existing fields
  readingHistory: [readingProgressSchema],
  bookmarks: [bookmarkSchema],
  favoriteBooks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book'
  }],
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deactivated'],
    default: 'active'
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ firebaseUid: 1 });
userSchema.index({ displayName: 1 });
userSchema.index({ 'personalDetails.location.country': 1 });
userSchema.index({ 'readingPreferences.favoriteGenres': 1 });
userSchema.index({ 'readingStats.booksRead': -1 });
userSchema.index({ 'readingStats.readingStreak': -1 });

// Helper method to update reading streak
userSchema.methods.updateReadingStreak = function() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if user read yesterday
  if (this.readingStats.lastReadingDate) {
    const lastReadDate = new Date(this.readingStats.lastReadingDate);
    const daysSinceLastRead = Math.floor((today - lastReadDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastRead === 1) {
      // Continued streak
      this.readingStats.currentStreak += 1;
      this.readingStats.readingStreak = Math.max(this.readingStats.readingStreak, this.readingStats.currentStreak);
    } else if (daysSinceLastRead === 0) {
      // Already read today, no change
    } else {
      // Streak broken
      this.readingStats.currentStreak = 0;
    }
  }
  
  this.readingStats.lastReadingDate = today;
  return this.save();
};

// Helper method to add a book to bookshelf
userSchema.methods.addToBookshelf = function(bookId, shelfType, gutenbergId = null) {
  const shelfEntry = {
    bookId: bookId,
    addedAt: new Date(),
    gutenbergId: gutenbergId
  };
  
  if (shelfType === 'currentlyReading') {
    shelfEntry.startedAt = new Date();
  }
  
  // Remove from other shelves if needed
  ['currentlyReading', 'wantToRead', 'read'].forEach(shelf => {
    if (shelf !== shelfType) {
      this.bookshelves[shelf] = this.bookshelves[shelf].filter(
        item => item.bookId.toString() !== bookId.toString()
      );
    }
  });
  
  // Add to selected shelf if not already there
  const exists = this.bookshelves[shelfType].some(
    item => item.bookId.toString() === bookId.toString()
  );
  
  if (!exists) {
    this.bookshelves[shelfType].push(shelfEntry);
  }
  
  return this.save();
};

// Helper method to get user profile for display
userSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    displayName: this.displayName,
    personalDetails: this.personalDetails,
    readingPreferences: this.readingPreferences,
    readingStats: this.readingStats,
    social: this.social,
    createdAt: this.createdAt,
    lastActive: this.lastActive
  };
};

// Static method to find by Firebase UID
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ firebaseUid });
};

module.exports = mongoose.model('User', userSchema);