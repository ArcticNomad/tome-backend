// backend/controllers/recommendController.js
import { recommendBooks } from '../services/embeddingService';
const User = require('../models/User');
const Book = require('../models/Book');
 const getRecommendations = async (req, res) => {
  console.log('🤖 [EMBEDDINGS] Controller called');
  const firebaseUid = req.firebaseUid;
  const { limit = 20 } = req.query;

  console.log('👤 User UID:', firebaseUid, 'Authenticated:', req.isAuthenticated);

  try {
    // If no user or not registered, return popular books
    if (!firebaseUid || !req.isAuthenticated) {
      console.log('👤 No registered user, returning popular books');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit) || 20)
        .select('title author coverImageUrl gutenbergId downloadCount subjects generated_blurb');
      
      return res.json({
        success: true,
        data: popularBooks,
        source: 'popular_no_user',
        message: 'Popular books (no registered user)',
        userRegistered: false
      });
    }

    // User exists, fetch from DB
    const user = await User.findOne({ firebaseUid });
    
    if (!user) {
      console.log('❌ User not found in database (should not happen)');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit) || 20)
        .select('title author coverImageUrl gutenbergId downloadCount subjects generated_blurb');
      
      return res.json({
        success: true,
        data: popularBooks,
        source: 'popular_user_not_in_db',
        message: 'User profile not found, showing popular books',
        userRegistered: false
      });
    }

    // Get user's favorite genres
    const favoriteGenres = user.readingPreferences?.favoriteGenres || [];
    console.log('🎭 User favorite genres:', favoriteGenres);
    
    let recommendations = [];
    let source = 'embeddings_ai';
    
    // If user has favorite genres, use embeddings AI
    if (favoriteGenres.length > 0) {
      console.log('🤖 Using AI embeddings for recommendations...');
      
      try {
        const { books } = await recommendBooks(favoriteGenres, parseInt(limit) || 20);
        
        if (books && books.length > 0) {
          console.log(`✅ Found ${books.length} books via embeddings`);
          recommendations = books;
          source = 'embeddings_ai';
        } else {
          console.log('⚠️ Embeddings returned empty, falling back...');
          throw new Error('No results from embeddings');
        }
      } catch (embeddingError) {
        console.log('⚠️ Embedding service error:', embeddingError.message);
        // Fall through to backup
      }
    }
    
    // Fallback if no embeddings results
    if (recommendations.length === 0) {
      console.log('📊 Falling back to popular books...');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit) || 20)
        .select('title author coverImageUrl gutenbergId downloadCount subjects generated_blurb');
      
      recommendations = popularBooks;
      source = favoriteGenres.length > 0 ? 'popular_fallback' : 'popular_no_genres';
    }
    
    console.log(`✅ Returning ${recommendations.length} books (source: ${source})`);
    
    res.json({
      success: true,
      data: recommendations,
      userGenres: favoriteGenres,
      total: recommendations.length,
      source: source,
      userRegistered: true,
      message: 'AI-powered recommendations loaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Recommendation error:', error);
    
    const fallbackBooks = await Book.find()
      .limit(parseInt(limit) || 20)
      .select('title author coverImageUrl gutenbergId subjects downloadCount generated_blurb');
    
    res.json({
      success: true,
      data: fallbackBooks,
      source: 'error_fallback',
      userRegistered: req.isAuthenticated || false,
      message: 'Using fallback recommendations'
    });
  }
};

module.exports = { getRecommendations };