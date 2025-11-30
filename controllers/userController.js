// backend/controllers/userController.js
const User = require('../models/User');
const Book = require('../models/Book');

// Update reading progress
const updateReadingProgress = async (req, res) => {
  try {
    const { bookId, gutenbergId, currentPage, progress, readingTime } = req.body;
    const userId = req.user.uid;

    // Find or create user
    let user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find book to verify it exists
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

    // Update or create reading progress
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

// Add/remove favorite book
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
      // Remove from favorites
      user.favoriteBooks.splice(bookIndex, 1);
      message = 'Book removed from favorites';
    } else {
      // Add to favorites
      user.favoriteBooks.push(bookId);
      message = 'Book added to favorites';
    }

    await user.save();

    res.json({
      success: true,
      data: {
        isFavorite: bookIndex === -1, // Toggled state
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

// Get user's reading history
const getReadingHistory = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await User.findOne({ firebaseUid: userId })
      .populate('readingHistory.bookId', 'title author coverImageUrl gutenbergId')
      .select('readingHistory');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.readingHistory
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

// Get user's favorite books
const getFavoriteBooks = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await User.findOne({ firebaseUid: userId })
      .populate('favoriteBooks', 'title author coverImageUrl gutenbergId downloadCount subjects')
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

module.exports = {
  updateReadingProgress,
  toggleFavoriteBook,
  getReadingHistory,
  getFavoriteBooks
};