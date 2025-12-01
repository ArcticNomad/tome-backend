// backend/controllers/userController.js
const User = require('../models/User');
const Book = require('../models/Book');

// ========== PROFILE MANAGEMENT ==========

// Create user profile (after Firebase signup)
const createUserProfile = async (req, res) => {
  try {
    const {
      displayName,
      personalDetails,
      readingPreferences,
      favoriteBook
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ firebaseUid: req.user.uid });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User profile already exists'
      });
    }


    // Create new user with profile data
    const user = new User({
      firebaseUid: req.user.uid,
      email: req.user.email,
      displayName: displayName || req.user.displayName || 'Reader',
      personalDetails: personalDetails || {},
      readingPreferences: readingPreferences || {},
      // Initialize empty bookshelves
      bookshelves: {
        currentlyReading: [],
        wantToRead: [],
        read: []
      },
      // Initialize reading stats
      readingStats: {
        booksRead: 0,
        readingStreak: 0,
        currentStreak: 0,
        totalReadingTime: 0,
        pagesRead: 0,
        averageRating: 0,
        reviewsWritten: 0
      },
      // Initialize social stats
      social: {
        friendsCount: 0,
        followingCount: 0,
        followersCount: 0
      }
    });

    // Add favorite book if provided
    if (favoriteBook) {
      user.readingPreferences.favoriteBook = favoriteBook;
    }

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User profile created successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Create user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user profile',
      error: error.message
    });
  }
};

const getBookStatus = async (req, res) => {
  

  try {
    const { bookId } = req.params;
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let status = '';
    
    // Check shelves efficiently in memory
    const isReading = user.bookshelves.currentlyReading.some(item => item.bookId.toString() === bookId);
    const isWant = user.bookshelves.wantToRead.some(item => item.bookId.toString() === bookId);
    const isRead = user.bookshelves.read.some(item => item.bookId.toString() === bookId);

    if (isReading) status = 'currentlyReading';
    else if (isWant) status = 'wantToRead';
    else if (isRead) status = 'read';

    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Get book status error:', error);
    res.status(500).json({ success: false, message: 'Error checking status' });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Allowed fields to update
    const allowedUpdates = [
      'displayName',
      'personalDetails',
      'readingPreferences',
      'preferences'
    ];

    // Update only allowed fields
    Object.keys(req.body).forEach(field => {
      if (allowedUpdates.includes(field) && req.body[field] !== undefined) {
        if (field === 'personalDetails' || field === 'readingPreferences') {
          // Merge nested objects
          user[field] = { ...user[field], ...req.body[field] };
        } else {
          user[field] = req.body[field];
        }
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// ========== BOOKSHELVES MANAGEMENT ==========

// Add book to bookshelf
const addToBookshelf = async (req, res) => {
  try {
    const { bookId, shelfType, gutenbergId } = req.body;
    const user = await User.findOne({ firebaseUid: req.user.uid });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate shelf type
    if (!['currentlyReading', 'wantToRead', 'read'].includes(shelfType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shelf type'
      });
    }

    // Use helper method
    await user.addToBookshelf(bookId, shelfType, gutenbergId);

    res.json({
      success: true,
      message: `Book added to ${shelfType}`,
      data: user.bookshelves[shelfType]
    });
  } catch (error) {
    console.error('Add to bookshelf error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding book to shelf',
      error: error.message
    });
  }
};

// Remove book from bookshelf
const removeFromBookshelf = async (req, res) => {
  try {
    const { bookId, shelfType } = req.params;
    const user = await User.findOne({ firebaseUid: req.user.uid });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate shelf type
    if (!['currentlyReading', 'wantToRead', 'read'].includes(shelfType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shelf type'
      });
    }

    // Remove book from shelf
    user.bookshelves[shelfType] = user.bookshelves[shelfType].filter(
      item => item.bookId.toString() !== bookId
    );

    await user.save();

    res.json({
      success: true,
      message: `Book removed from ${shelfType}`
    });
  } catch (error) {
    console.error('Remove from bookshelf error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing book from shelf',
      error: error.message
    });
  }
};

// Get bookshelf
const getBookshelf = async (req, res) => {
  try {
    const { shelfType } = req.params;
    const user = await User.findOne({ firebaseUid: req.user.uid })
      .populate({
        path: `bookshelves.${shelfType}.bookId`,
        select: 'title author coverImageUrl gutenbergId subjects downloadCount averageRating'
      });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate shelf type
    if (!['currentlyReading', 'wantToRead', 'read'].includes(shelfType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shelf type'
      });
    }

    res.json({
      success: true,
      data: user.bookshelves[shelfType]
    });
  } catch (error) {
    console.error('Get bookshelf error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookshelf',
      error: error.message
    });
  }
};

// ========== READING PROGRESS ==========

const updateReadingProgress = async (req, res) => {
  try {
    const { bookId, gutenbergId, currentPage, progress, readingTime } = req.body;
    const userId = req.user.uid;

    let user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find book
    let book;
    if (gutenbergId) {
      book = await Book.findOne({ gutenbergId });
    } else {
      book = await Book.findById(bookId);
    }

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Update reading progress
    const existingProgress = user.readingHistory.find(
      item => item.bookId.toString() === book._id.toString()
    );

    if (existingProgress) {
      existingProgress.currentPage = currentPage;
      existingProgress.progress = progress;
      existingProgress.lastRead = new Date();
      existingProgress.readingTime += readingTime || 0;
      existingProgress.isFinished = progress >= 100;
    } else {
      user.readingHistory.push({
        bookId: book._id,
        gutenbergId: book.gutenbergId,
        currentPage,
        progress,
        readingTime: readingTime || 0,
        lastRead: new Date(),
        isFinished: progress >= 100
      });
    }

    // Update reading stats
    if (progress >= 100 && !existingProgress?.isFinished) {
      user.readingStats.booksRead += 1;
      // Add to "read" bookshelf automatically
      await user.addToBookshelf(book._id, 'read', book.gutenbergId);
    }

    // Update reading streak
    await user.updateReadingStreak();

    // Update total reading time
    user.readingStats.totalReadingTime += (readingTime || 0) / 60; // Convert minutes to hours
    user.readingStats.lastReadingDate = new Date();

    await user.save();

    res.json({
      success: true,
      data: existingProgress || user.readingHistory[user.readingHistory.length - 1],
      message: 'Reading progress updated'
    });
  } catch (error) {
    console.error('Update reading progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating reading progress',
      error: error.message
    });
  }
};

// ========== FAVORITE BOOKS ==========

const toggleFavoriteBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.uid;

    const user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const bookIndex = user.favoriteBooks.indexOf(bookId);
    let message;

    if (bookIndex > -1) {
      user.favoriteBooks.splice(bookIndex, 1);
      message = 'Book removed from favorites';
    } else {
      user.favoriteBooks.push(bookId);
      message = 'Book added to favorites';
    }

    await user.save();

    res.json({
      success: true,
      data: {
        isFavorite: bookIndex === -1,
        favoriteBooks: user.favoriteBooks
      },
      message
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating favorites',
      error: error.message
    });
  }
};

// ========== READING HISTORY & STATS ==========

const getReadingHistory = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await User.findOne({ firebaseUid: userId })
      .populate({
        path: 'readingHistory.bookId',
        select: 'title author coverImageUrl gutenbergId subjects'
      })
      .select('readingHistory readingStats');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        history: user.readingHistory,
        stats: user.readingStats
      }
    });
  } catch (error) {
    console.error('Get reading history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reading history',
      error: error.message
    });
  }
};

const getFavoriteBooks = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await User.findOne({ firebaseUid: userId })
      .populate('favoriteBooks', 'title author coverImageUrl gutenbergId downloadCount subjects averageRating')
      .select('favoriteBooks');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.favoriteBooks
    });
  } catch (error) {
    console.error('Get favorite books error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching favorite books',
      error: error.message
    });
  }
};

// ========== USER STATISTICS ==========
// backend/controllers/userController.js

const getUserStatistics = async (req, res) => {
  try {
    // FIX 1: Added 'readingHistory' and 'createdAt' to the select list
    const user = await User.findOne({ firebaseUid: req.user.uid })
      .select('readingStats social personalDetails readingHistory createdAt'); 
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // FIX 2: Better date handling (fall back to current date if missing)
    const joinDate = user.createdAt || (user.personalDetails && user.personalDetails.createdAt) || new Date();
    const daysSinceJoin = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24));
    
    const booksPerMonth = daysSinceJoin > 30 
      ? (user.readingStats.booksRead / (daysSinceJoin / 30)).toFixed(1)
      : user.readingStats.booksRead; // Just return total if less than a month

    // FIX 3: Safety check for readingHistory
    const historyLength = user.readingHistory ? user.readingHistory.length : 0;

    const stats = {
      basic: user.readingStats,
      social: user.social,
      calculated: {
        daysSinceJoin,
        booksPerMonth,
        readingEfficiency: user.readingStats.totalReadingTime > 0 
          ? (user.readingStats.pagesRead / user.readingStats.totalReadingTime).toFixed(1)
          : 0,
        completionRate: historyLength > 0
          ? ((user.readingStats.booksRead / historyLength) * 100).toFixed(1)
          : 0
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};

// ========== BOOKMARKS ==========

const addBookmark = async (req, res) => {
  try {
    const { bookId, gutenbergId, pageNumber, note } = req.body;
    
    const user = await User.findOne({ firebaseUid: req.user.uid });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.bookmarks.push({
      bookId,
      gutenbergId,
      pageNumber,
      note,
      createdAt: new Date()
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Bookmark added',
      data: user.bookmarks[user.bookmarks.length - 1]
    });
  } catch (error) {
    console.error('Add bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding bookmark',
      error: error.message
    });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid })
      .populate('bookmarks.bookId', 'title author coverImageUrl gutenbergId');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.bookmarks
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookmarks',
      error: error.message
    });
  }
};

module.exports = {
  // Profile Management
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  
  // Bookshelves
  addToBookshelf,
  removeFromBookshelf,
  getBookshelf,
  
  // Reading Progress & History
  updateReadingProgress,
  getReadingHistory,
  
  // Favorites
  toggleFavoriteBook,
  getFavoriteBooks,
  
  // Statistics
  getUserStatistics,
  
  // Bookmarks
  addBookmark,
  getBookmarks,

  getBookStatus
};