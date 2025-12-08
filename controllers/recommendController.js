// backend/controllers/recommendController.js
const { recommendBooks } = require('../services/recommendService');
const User = require('../models/User');
const Book = require('../models/Book');

const getRecommendations = async (req, res) => {
  console.log('🤖 [CONTROLLER] getRecommendations called');
  console.log('🔑 req.firebaseUid:', req.firebaseUid);
  console.log('✅ req.isAuthenticated:', req.isAuthenticated);
  console.log('👤 req.userData:', req.userData);
  
  const firebaseUid = req.firebaseUid;
  const { limit = 20 } = req.query;

  try {
    // If user is not authenticated, return popular books
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

    // Get user from middleware data
    const user = req.userData;
    
    console.log('👤 User data for recommendations:', {
      id: user._id,
      displayName: user.displayName,
      email: user.email,
      readingPreferences: user.readingPreferences
    });
    
    // Get user's favorite genres from reading preferences
    let favoriteGenres = [];
    
    if (user.readingPreferences && user.readingPreferences.favoriteGenres) {
      favoriteGenres = user.readingPreferences.favoriteGenres;
    } else {
      // Try fallback to legacy field
      favoriteGenres = user.favoriteGenres || [];
    }
    
    console.log('🎭 Favorite genres extracted:', {
      genres: favoriteGenres,
      count: favoriteGenres.length,
      fromReadingPrefs: user.readingPreferences ? true : false
    });
    
    let recommendations = [];
    let source = 'embeddings';
    let message = '';
    
    // If user has favorite genres, use embeddings AI
    if (favoriteGenres && favoriteGenres.length > 0) {
      console.log('🤖 Using AI embeddings with user genres...');
      
      try {
        const result = await recommendBooks(favoriteGenres, parseInt(limit));
        
        if (result.books && result.books.length > 0) {
          console.log(`✅ Found ${result.books.length} books via embeddings`);
          recommendations = result.books;
          source = result.source || 'embeddings';
          message = 'AI-powered recommendations based on your preferences';
        } else {
          console.log('⚠️ Embeddings returned empty, falling back...');
          throw new Error('No results from embeddings');
        }
      } catch (embeddingError) {
        console.log('⚠️ Embedding service error:', embeddingError.message);
        message = `Embedding service error: ${embeddingError.message}`;
        // Continue to fallback
      }
    } else {
      console.log('⚠️ User has no favorite genres');
      message = 'No favorite genres found in your profile';
    }
    
    // Fallback if no embeddings results
    if (recommendations.length === 0) {
      console.log('📊 Falling back to popular books...');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit))
        .select('title author coverImageUrl gutenbergId downloadCount subjects genres generated_blurb description');
      
      recommendations = popularBooks;
      source = favoriteGenres && favoriteGenres.length > 0 
        ? 'popular_fallback' 
        : 'popular_no_genres';
      
      message = favoriteGenres && favoriteGenres.length > 0
        ? 'Using popular books (AI service unavailable)'
        : 'Popular books (add favorite genres for personalized recommendations)';
    }
    
    console.log(`✅ Returning ${recommendations.length} books (source: ${source})`);
    
    res.json({
      success: true,
      data: recommendations,
      userGenres: favoriteGenres,
      total: recommendations.length,
      source: source,
      userRegistered: true,
      isPersonalized: source === 'embeddings',
      message: message
    });
    
  } catch (error) {
    console.error('❌ Recommendation controller error:', error);
    
    // Final fallback
    const fallbackBooks = await Book.find()
      .limit(Math.min(parseInt(limit), 20))
      .select('title author coverImageUrl gutenbergId subjects genres downloadCount generated_blurb description');
    
    res.json({
      success: true,
      data: fallbackBooks,
      source: 'error_fallback',
      userRegistered: req.isAuthenticated || false,
      message: 'Using fallback recommendations due to an error'
    });
  }
};

module.exports = { getRecommendations };