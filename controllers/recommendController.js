// backend/controllers/recommendController.js
const { recommendBooks } = require('../services/recommendService');
const User = require('../models/User');
const Book = require('../models/Book');

const getRecommendations = async (req, res) => {
  console.log('🤖 [CONTROLLER] getRecommendations called');
  const { limit = 20 } = req.query;

  try {
    if (!req.isAuthenticated || !req.userData) {
      console.log('👤 No authenticated user, returning popular books');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit))
        .select('title author coverImageUrl gutenbergId downloadCount subjects genres generated_blurb description');
      
      return res.json({
        success: true,
        data: popularBooks,
        source: 'popular_no_user',
        message: 'Popular books (no authenticated user)',
        userRegistered: false
      });
    }

    const user = req.userData;
    console.log('👤 User data for recommendations:', { id: user._id, displayName: user.displayName });
    
    let favoriteGenres = user.readingPreferences?.favoriteGenres || user.favoriteGenres || [];
    console.log('🎭 Favorite genres extracted:', { count: favoriteGenres.length });
    
    let recommendations = [];
    let source = 'init';
    let message = '';

    try {
      console.log('🤖 Calling recommendBooks service...');
      const result = await recommendBooks({
        userId: user._id,
        favoriteGenres,
        limit: parseInt(limit)
      });
      
      if (result.books && result.books.length > 0) {
        console.log(`✅ Found ${result.books.length} books via recommendService (source: ${result.source})`);
        recommendations = result.books;
        source = result.source;
        message = 'AI-powered recommendations for you';
      } else {
        console.log('⚠️ recommendService returned empty, falling back...');
        source = result.source || 'empty_from_service';
      }
    } catch (embeddingError) {
      console.log('⚠️ recommendService error:', embeddingError.message);
      message = `Recommendation service error: ${embeddingError.message}`;
      source = 'service_error';
    }
    
    // Fallback if no recommendations were found
    if (recommendations.length === 0) {
      console.log('📊 Falling back to popular books...');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit))
        .select('title author coverImageUrl gutenbergId downloadCount subjects genres generated_blurb description');
      
      recommendations = popularBooks;
      // Keep the source to indicate why we fell back
      source = source.includes('embeddings') ? 'popular_fallback' : 'popular_no_genres';
      message = 'Here are some popular books to check out.';
    }
    
    console.log(`✅ Returning ${recommendations.length} books (source: ${source})`);
    
    res.json({
      success: true,
      data: recommendations,
      userGenres: favoriteGenres,
      total: recommendations.length,
      source: source,
      userRegistered: true,
      isPersonalized: source.includes('embeddings'),
      message: message
    });
    
  } catch (error) {
    console.error('❌ Recommendation controller error:', error);
    
    // Final fallback in case of a major error
    try {
      const fallbackBooks = await Book.find()
        .limit(Math.min(parseInt(limit), 20))
        .select('title author coverImageUrl gutenbergId subjects genres downloadCount');
      
      res.status(500).json({
        success: false,
        data: fallbackBooks,
        source: 'error_fallback',
        userRegistered: req.isAuthenticated || false,
        message: 'Using fallback recommendations due to a server error.'
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        data: [],
        source: 'fatal_error',
        message: 'Could not retrieve any recommendations.'
      });
    }
  }
};

module.exports = { getRecommendations };