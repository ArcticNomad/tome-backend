// backend/controllers/reviewController.js
const Review = require('../models/Review');
const Book = require('../models/Book');


const getBookReviews = async (req, res) => {
  try {
    const { bookId } = req.params; 
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'helpful', 
      minRating 
    } = req.query;

    console.log(`📝 Getting reviews for book: ${bookId}`);

  
    let query = { bookId: bookId };
    
    if (minRating) {
      query.rating = { $gte: parseInt(minRating) };
    }

    // Sort options 
    const sortOptions = {};
    if (sortBy === 'helpful') {
      sortOptions.likes = -1;
      sortOptions.createdAt = -1;
    } else if (sortBy === 'recent') {
      sortOptions.createdAt = -1;
    } else if (sortBy === 'rating') {
      sortOptions.rating = -1;
      sortOptions.createdAt = -1;
    }

    // Execute query with pagination
    const reviews = await Review.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count and average rating
    const total = await Review.countDocuments(query);

    const stats = await Review.aggregate([
      { $match: query },
      { 
        $group: {
          _id: '$bookId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    // Update book's average rating by finding book first
    if (stats.length > 0) {
      const book = await Book.findOne({ gutenbergId: bookId });
      if (book) {
        await Book.findByIdAndUpdate(book._id, {
          averageRating: stats[0].averageRating.toFixed(1),
          reviewCount: stats[0].totalReviews
        });
      }
    }

    console.log(`✅ Found ${reviews.length} reviews`);
    
    res.json({
      success: true,
      data: reviews,
      stats: stats[0] || { averageRating: 0, totalReviews: 0 },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// Create a new review
const createReview = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { rating, title, content } = req.body;
    const user = req.user;

    console.log(`Creating review for book: ${bookId} by user: ${user.uid}`);
    console.log('Request body:', { rating, title, content });
    console.log('User info:', { uid: user.uid, email: user.email, name: user.name });

    // Validate required fields
    if (!rating || !content) {
      return res.status(400).json({
        success: false,
        message: 'Rating and content are required'
      });
    }

    // Check if book exists by gutenbergId
    const book = await Book.findOne({ gutenbergId: bookId });
    if (!book) {
      console.log(`❌ Book with gutenbergId ${bookId} not found in database`);
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    console.log(`✅ Found book: ${book.title} (${book._id})`);

    // Check if user already reviewed this book
    const existingReview = await Review.findOne({
      bookId: bookId,
      userId: user.uid
    });

    if (existingReview) {
      console.log(`❌ User ${user.uid} already reviewed book ${bookId}`);
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this book'
      });
    }

    // Create new review with string bookId
    const review = new Review({
      bookId: bookId,
      userId: user.uid,
      userEmail: user.email,
      userName: user.name || user.email.split('@')[0],
      userAvatar: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email.split('@')[0])}&background=random`,
      rating: parseInt(rating),
      title: title || '',
      content: content
    });

    await review.save();

    console.log(`✅ Review created: ${review._id}`);
    
    // Update book's review stats using string bookId
    const stats = await Review.aggregate([
      { $match: { bookId: bookId } },
      { 
        $group: {
          _id: '$bookId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      // Update book by its _id (ObjectId)
      await Book.findByIdAndUpdate(book._id, {
        averageRating: stats[0].averageRating.toFixed(1),
        reviewCount: stats[0].totalReviews
      });
      console.log(`✅ Updated book stats for ${bookId}`);
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review
    });
  } catch (error) {
    console.error('❌ Create review error details:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Error name:', error.name);
    
    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message,
        errors: error.errors
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.error('MongoDB error code:', error.code);
    }

    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: error.message
    });
  }
};
// Update a review
const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, content } = req.body;
    const user = req.user;

    console.log(`🔄 Updating review: ${reviewId}`);

    const review = await Review.findOne({
      _id: reviewId,
      userId: user.uid
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or unauthorized'
      });
    }

    // Update review
    review.rating = rating || review.rating;
    review.title = title || review.title;
    review.content = content || review.content;
    review.updatedAt = Date.now();

    await review.save();

    console.log(`✅ Review updated: ${reviewId}`);
    
    // Update book's average rating - find book by gutenbergId
    const book = await Book.findOne({ gutenbergId: review.bookId });
    if (book) {
      const stats = await Review.aggregate([
        { $match: { bookId: review.bookId } },
        { 
          $group: {
            _id: '$bookId',
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      if (stats.length > 0) {
        await Book.findByIdAndUpdate(book._id, {
          averageRating: stats[0].averageRating.toFixed(1),
          reviewCount: stats[0].totalReviews
        });
      }
    }

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });
  } catch (error) {
    console.error('❌ Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating review',
      error: error.message
    });
  }
};
// Delete a review
// Delete a review
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = req.user;

    console.log(`🗑️ Deleting review: ${reviewId}`);

    const review = await Review.findOneAndDelete({
      _id: reviewId,
      userId: user.uid
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or unauthorized'
      });
    }

    console.log(`✅ Review deleted: ${reviewId}`);
    
    // Update book's average rating - find book by gutenbergId
    const book = await Book.findOne({ gutenbergId: review.bookId });
    if (book) {
      const stats = await Review.aggregate([
        { $match: { bookId: review.bookId } },
        { 
          $group: {
            _id: '$bookId',
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      if (stats.length > 0) {
        await Book.findByIdAndUpdate(book._id, {
          averageRating: stats[0].averageRating?.toFixed(1) || 0,
          reviewCount: stats[0].totalReviews || 0
        });
      } else {
        // No reviews left
        await Book.findByIdAndUpdate(book._id, {
          averageRating: 0,
          reviewCount: 0
        });
      }
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: error.message
    });
  }
};

// Mark review as helpful
const markHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user = req.user;

    console.log(`👍 Marking review as helpful: ${reviewId}`);

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already marked as helpful
    if (review.helpful.includes(user.uid)) {
      // Remove helpful
      const index = review.helpful.indexOf(user.uid);
      review.helpful.splice(index, 1);
      review.likes = Math.max(0, review.likes - 1);
    } else {
      // Add helpful
      review.helpful.push(user.uid);
      review.likes = review.likes + 1;
    }

    await review.save();

    res.json({
      success: true,
      message: 'Helpful status updated',
      data: {
        likes: review.likes,
        isHelpful: review.helpful.includes(user.uid)
      }
    });
  } catch (error) {
    console.error('❌ Mark helpful error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating helpful status',
      error: error.message
    });
  }
};

// Get user's reviews
// Get user's reviews
const getUserReviews = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 10 } = req.query;

    console.log(`👤 Getting reviews for user: ${user.uid}`);

    const reviews = await Review.find({ userId: user.uid })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Manually get book data for each review
    const reviewsWithBooks = await Promise.all(
      reviews.map(async (review) => {
        const book = await Book.findOne({ gutenbergId: review.bookId });
        return {
          ...review.toObject(),
          bookId: book ? {
            _id: book._id,
            title: book.title,
             gutenbergId: book.gutenbergId,
            author: book.author,
            coverImageUrl: book.coverImageUrl
          } : null
        };
      })
    );

    const total = await Review.countDocuments({ userId: user.uid });

    res.json({
      success: true,
      data: reviewsWithBooks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user reviews',
      error: error.message
    });
  }
};

module.exports = {
  getBookReviews,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
  getUserReviews
};