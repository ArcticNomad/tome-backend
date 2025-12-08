// backend/controllers/recommendController.js
const User = require('../models/User'); // ← Your rich User model
const { recommendBooks } = require("../services/recommendService");

const getRecommendations = async (req, res) => {
  console.log('AI Recommendations called');
  const firebaseUid = req.firebaseUid;
  const { limit = 20 } = req.query;

  try {
    // 1. Guest user → popular books
    if (!firebaseUid || firebaseUid.includes('demo-user')) {
      const popular = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit))
        .select('title author coverImageUrl gutenbergId subjects generated_blurb');

      return res.json({
        success: true,
        data: popular,
        source: 'popular_guest',
        userGenres: [],
        userRegistered: false
      });
    }

    // 2. Find user in DB
    const user = await User.findOne({ firebaseUid })
      .select('readingPreferences readingHistory bookshelves.read');

    if (!user) {
      const popular = await Book.find()
        .sort({ downloadCount: -1 })
        .limit(parseInt(limit))
        .select('title author coverImageUrl gutenbergId');

      return res.json({
        success: true,
        data: popular,
        source: 'popular_no_profile',
        userGenres: [],
        userRegistered: false
      });
    }

    // 3. Extract favorite genres
    const favoriteGenres = user.readingPreferences?.favoriteGenres || [];

    // 4. BONUS: Boost with recently read/finished books
    const recentlyRead = user.readingHistory
      ?.filter(h => h.progress > 70 || h.isFinished)
      .slice(0, 5)
      .map(h => h.bookId?.title || '')
      .filter(Boolean);

    const finishedBooks = user.bookshelves?.read
      ?.slice(0, 5)
      .map(b => b.bookId?.title || '')
      .filter(Boolean);

    const context = [...new Set([...favoriteGenres, ...recentlyRead, ...finishedBooks])];

    console.log('User context:', context);

    // 5. Call AI embeddings
    const { books } = await recommendBooks(context.length > 0 ? context : favoriteGenres, parseInt(limit));

    res.json({
      success: true,
      data: books,
      userGenres: favoriteGenres,
      contextUsed: context,
      source: books.length > 0 ? 'embeddings_ai' : 'fallback',
      userRegistered: true,
      message: context.length > 0
        ? 'Personalized from your reading history + preferences'
        : favoriteGenres.length > 0
        ? 'Based on your favorite genres'
        : 'Popular books (set your genres for better results!)'
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    const fallback = await Book.find().sort({ downloadCount: -1 }).limit(20);
    res.json({
      success: true,
      data: fallback,
      source: 'error_fallback',
      userRegistered: !!firebaseUid
    });
  }
};

module.exports = { getRecommendations };