  // backend/controllers/userController.js
  const User = require('../models/User');
  const Book = require('../models/Book');

  // ========== PROFILE MANAGEMENT ==========

  // Create user profile (after Firebase signup)
  // backend/controllers/userController.js → REPLACE createUserProfile
// backend/controllers/userController.js - UPDATE createUserProfile with detailed logging

const createUserProfile = async (req, res) => {
  try {
    console.log('🚨🚨🚨 CREATE USER PROFILE CALLED 🚨🚨🚨');
    console.log('📦 Full request body:', JSON.stringify(req.body, null, 2));
    console.log('🔐 Headers:', req.headers);
    console.log('👤 Auth user:', req.user);
    console.log('🔑 Firebase UID from headers:', req.headers['firebase-uid']);

    const {
      displayName,
      email,
      firebaseUid,
      gender,
      birthDate,
      location,
      favoriteGenres,
      readingGoal,
      favoriteBook
    } = req.body;

    console.log('📝 Parsed data:');
    console.log('  - displayName:', displayName);
    console.log('  - email:', email);
    console.log('  - firebaseUid:', firebaseUid);
    console.log('  - gender:', gender, '(type:', typeof gender, ')');
    console.log('  - birthDate:', birthDate);
    console.log('  - location:', location);
    console.log('  - favoriteGenres:', favoriteGenres);
    console.log('  - readingGoal:', readingGoal);
    console.log('  - favoriteBook:', favoriteBook);

    // Check if profile already exists
    const existingUser = await User.findOne({ firebaseUid });
    if (existingUser) {
      console.log('⚠️ Profile already exists for:', firebaseUid);
      return res.status(400).json({
        success: false,
        message: 'Profile already exists'
      });
    }

    // Try creating user step by step to see where it fails
    console.log('🔄 Creating user object...');
    
    const userData = {
      firebaseUid: firebaseUid || req.user?.uid || req.headers['firebase-uid'],
      email: email || req.user?.email || '',
      displayName: displayName || email?.split('@')[0] || 'User',
    };

    console.log('📦 Basic user data:', userData);

    // Try creating without personalDetails first
    const testUser = new User(userData);
    
    console.log('🧪 Testing user creation...');
    
    // Validate without saving
    const validationError = testUser.validateSync();
    if (validationError) {
      console.log('❌ Validation error:', validationError.errors);
      throw validationError;
    }

    console.log('✅ Basic validation passed');

    // Now add personalDetails
    userData.personalDetails = {
      gender: gender || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      location: location ? {
        city: location.split(',')[0]?.trim() || '',
        country: location.split(',')[1]?.trim() || location.split(',')[0]?.trim() || ''
      } : { city: '', country: '' },
      profilePicture: null,
      bio: ''
    };

    console.log('📦 User data with personalDetails:', JSON.stringify(userData, null, 2));

    const user = new User(userData);
    
    console.log('💾 Saving user to database...');
    await user.save();
    
    console.log('✅ MongoDB profile created successfully for:', firebaseUid);

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      data: user.getPublicProfile()
    });

  } catch (error) {
    console.error('❌❌❌ FATAL ERROR in createUserProfile ❌❌❌');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.errors) {
      console.error('Validation errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}:`, error.errors[key]);
      });
    }
    
    console.error('Request body was:', req.body);
    console.error('User model schema:', User.schema && User.schema.obj ? 'Schema exists' : 'No schema found');

    res.status(500).json({
      success: false,
      message: 'Failed to create profile',
      error: error.message,
      details: error.errors
    });
  }
};
  const checkAvailability = async (req, res) => {
    try {
      const { field, value } = req.query;

      if (!field || !value) {
        return res.status(400).json({
          success: false,
          message: 'Field and value are required'
        });
      }

      // Only allow checking specific fields
      const allowedFields = ['displayName', 'email'];
      if (!allowedFields.includes(field)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid field for availability check'
        });
      }

      const query = {};
      // Case-insensitive check for display name
      if (field === 'displayName') {
        query[field] = { $regex: new RegExp(`^${value}$`, 'i') };
      } else {
        query[field] = value;
      }

      const existingUser = await User.findOne(query);

      res.json({
        success: true,
        available: !existingUser,
        message: existingUser ? `${field} is already taken` : `${field} is available`
      });
    } catch (error) {
      console.error('Check availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking availability',
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

  // backend/controllers/userController.js
  const getUserProfile = async (req, res) => {
    try {
      const user = await User.findOne({ firebaseUid: req.user.uid });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
      }

      res.json({
        success: true,
        data: user.getPublicProfile()
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
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
      const { shelfType, bookId } = req.params;
      const user = await User.findOne({ firebaseUid: req.user.uid });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Convert kebab-case to camelCase for internal use
      const normalizeShelfType = (type) => {
        switch(type) {
          case 'currently-reading':
            return 'currentlyReading';
          case 'want-to-read':
            return 'wantToRead';
          case 'read':
            return 'read';
          default:
            return type;
        }
      };

      const normalizedShelfType = normalizeShelfType(shelfType);

      // Validate shelf type
      if (!['currentlyReading', 'wantToRead', 'read'].includes(normalizedShelfType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid shelf type: ${shelfType}`
        });
      }

      console.log(`Removing book ${bookId} from ${normalizedShelfType} for user ${req.user.uid}`);
      console.log('BookId type:', typeof bookId, 'Value:', bookId);

      // Get initial count
      const initialCount = user.bookshelves[normalizedShelfType]?.length || 0;
      console.log('Initial books:', JSON.stringify(user.bookshelves[normalizedShelfType], null, 2));

      // FIXED: Compare against gutenbergId, not MongoDB _id
      user.bookshelves[normalizedShelfType] = user.bookshelves[normalizedShelfType].filter(
        item => {
          // Convert both to strings for comparison
          const itemGutenbergId = item.gutenbergId?.toString();
          const targetBookId = bookId.toString();
          
          console.log(`Comparing gutenbergId: ${itemGutenbergId} !== ${targetBookId} = ${itemGutenbergId !== targetBookId}`);
          
          // If gutenbergIds don't match, keep the item
          return itemGutenbergId !== targetBookId;
        }
      );

      const finalCount = user.bookshelves[normalizedShelfType]?.length || 0;
      console.log('Final books:', JSON.stringify(user.bookshelves[normalizedShelfType], null, 2));

      await user.save();

      console.log(`Removed book from ${normalizedShelfType}. Count: ${initialCount} -> ${finalCount}`);

      res.json({
        success: true,
        message: `Book removed from ${shelfType}`,
        count: finalCount
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

  // backend/controllers/userController.js
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

      // Update reading activity streak
      await user.updateReadingActivity();

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
        
        // Add to "read" bookshelf automatically if not already there
        const isAlreadyRead = user.bookshelves.read.some(
          item => item.bookId.toString() === book._id.toString()
        );
        
        if (!isAlreadyRead) {
          await user.addToBookshelf(book._id, 'read', book.gutenbergId);
        }
      }

      // Update total reading time (in hours)
      const additionalTime = readingTime || 0;
      user.readingStats.totalReadingTime += additionalTime / 60; // Convert minutes to hours
      
      // Update pages read
      if (currentPage) {
        user.readingStats.pagesRead += Math.max(0, currentPage - (existingProgress?.currentPage || 0));
      }

      // Update last reading date
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

  // backend/controllers/userController.js
  // In your userController.js, update the statistics function:
  const getUserStatistics = async (req, res) => { 
    try {
      const user = await User.findOne({ firebaseUid: req.user.uid })
        .select('readingStats bookshelves lastActive');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user's activity first
      await user.updateReadingActivity();

      // Calculate statistics
      const booksRead = user.bookshelves.read?.length || 0;
      
      const stats = {
        basic: {
          booksRead: booksRead,
          readingStreak: user.readingStats.readingStreak || 0,
          currentStreak: user.readingStats.currentStreak || 0,
          totalReadingTime: Math.round((user.readingStats.totalReadingTime || 0) * 10) / 10,
          pagesRead: user.readingStats.pagesRead || 0,
          averageRating: user.readingStats.averageRating || 0,
          reviewsWritten: user.readingStats.reviewsWritten || 0
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

  // Add this function to get user reviews
  const getUserReviews = async (req, res) => {
    try {
      const userId = req.user.uid;
      
      // First, get the user to find their MongoDB _id
      const user = await User.findOne({ firebaseUid: userId });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Now fetch reviews for this user
      // Assuming you have a Review model
      const Review = require('../models/Review'); // Make sure to import your Review model
      
      const reviews = await Review.find({ userId: user._id })
        .populate('bookId', 'title author coverImageUrl gutenbergId subjects')
        .sort({ createdAt: -1 })
        .lean();

      // Format the response
      const formattedReviews = reviews.map(review => ({
        _id: review._id,
        bookId: review.bookId?._id,
        book: {
          _id: review.bookId?._id,
          title: review.bookId?.title || 'Unknown Book',
          author: review.bookId?.author || 'Unknown Author',
          coverImage: review.bookId?.coverImageUrl,
          gutenbergId: review.bookId?.gutenbergId
        },
        rating: review.rating || 0,
        content: review.content || '',
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        helpful: review.helpful || [],
        helpfulCount: review.helpful?.length || 0,
        commentCount: review.comments?.length || 0
      }));

      res.json({
        success: true,
        data: formattedReviews,
        count: formattedReviews.length
      });
    } catch (error) {
      console.error('Get user reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user reviews',
        error: error.message
      });
    }
  };

  module.exports = {
    // Profile Management
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    checkAvailability,
    getUserReviews,

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