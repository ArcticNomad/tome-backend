// backend/controllers/becauseYouLikedController.js
const { getBecauseYouLikedRecommendations } = require('../services/userBookService');
const Book = require('../models/Book');

const getBecauseYouLiked = async (req, res) => {

   console.log('========================================');
  console.log(' [BECAUSE-YOU-LIKED] ENDPOINT usaed');
  console.log(' Full URL:', req.originalUrl);
  console.log(' Path:', req.path);
  console.log(' Query params:', req.query);
  console.log(' Firebase UID:', req.firebaseUid);
  console.log(' Is authenticated:', req.isAuthenticated);
  console.log(' User data:', req.userData);
  console.log('========================================');
  
  const firebaseUid = req.firebaseUid;
  const { limit = 10 } = req.query;
  
  try {
    if (!firebaseUid) {
      console.log('👤 No user logged in');
      // Return popular books for non-logged-in users
      const popularBooks = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(limit)
        .select('title author coverImageUrl gutenbergId downloadCount subjects');
      
      return res.json({
        success: true,
        data: popularBooks,
        source: 'popular_no_user',
        message: 'Popular books'
      });
    }
    

    const result = await getBecauseYouLikedRecommendations(firebaseUid, parseInt(limit));
    
    if (result.books.length > 0) {
      console.log(`✅ Returning ${result.books.length} "Because You Liked" recommendations`);
      
      return res.json({
        success: true,
        data: result.books,
        source: result.source,
        sourceBook: result.sourceBook,
        message: result.message,
        total: result.books.length
      });
    }
    
    
    console.log('🔄 Falling back to popular books');
    const popularBooks = await Book.find()
      .sort({ downloadCount: -1 })
      .limit(limit)
      .select('title author coverImageUrl gutenbergId downloadCount subjects');
    
    res.json({
      success: true,
      data: popularBooks,
      source: 'popular_fallback',
      message: 'Popular books as fallback',
      total: popularBooks.length
    });
    
  } catch (error) {
    console.error('❌ Error in getBecauseYouLiked:', error);
    
    const fallbackBooks = await Book.find()
      .limit(limit)
      .select('title author coverImageUrl gutenbergId');
    
    res.json({
      success: true,
      data: fallbackBooks,
      source: 'error_fallback',
      message: 'Using fallback recommendations'
    });
  }
};

module.exports = { getBecauseYouLiked };