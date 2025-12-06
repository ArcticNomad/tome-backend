// backend/controllers/recommendController.js - Update to accept limit parameter
const { getUserByFirebaseUid } = require("../services/userService");
const { recommendBooks } = require("../services/recommendService");
const Book = require('../models/Book');

/**
 * GET /api/books/similar-recommendations
 * Returns book recommendations based on user's favorite genres using AI embeddings
 */
const getRecommendations = async (req, res) => {
  console.log('🤖 [EMBEDDINGS] Controller called');
  const firebaseUid = req.firebaseUid;
  const { limit = 20 } = req.query; // Get limit from query params, default to 20
  
  console.log('👤 User UID:', firebaseUid, 'Limit requested:', limit);
  
  try {
    // If no user, return popular books
    if (!firebaseUid) {
      console.log('👤 No user, returning popular books');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit) || 20)
        .select('title author coverImageUrl gutenbergId downloadCount subjects generated_blurb');
      
      return res.json({
        success: true,
        data: popularBooks,
        source: 'popular_no_user',
        message: 'Popular books (no user logged in)',
        limit: popularBooks.length
      });
    }

    // Fetch user from MongoDB
    const user = await getUserByFirebaseUid(firebaseUid);
    
    if (!user) {
      console.log('❌ User not found in database');
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit) || 20)
        .select('title author coverImageUrl gutenbergId downloadCount subjects generated_blurb');
      
      return res.json({
        success: true,
        data: popularBooks,
        source: 'popular_user_not_in_db',
        message: 'User profile not found, showing popular books',
        limit: popularBooks.length
      });
    }

    // Get user's favorite genres
    const favoriteGenres = user.favoriteGenres || user.readingPreferences?.favoriteGenres || [];
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
          
          // Log what we found
          console.log('📚 Sample books returned:');
          books.slice(0, 5).forEach((book, i) => {
            console.log(`   ${i + 1}. ${book.title} by ${book.author || 'Unknown'} (ID: ${book.gutenbergId})`);
          });
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
      limit: recommendations.length,
      source: source,
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
      userGenres: [],
      source: 'error_fallback',
      message: 'Using fallback recommendations'
    });
  }
};

module.exports = { getRecommendations };