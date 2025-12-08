// backend/services/recommendService.js
const { qdrant } = require("../config/qdrantConfig");
const Book = require('../models/Book');
const User = require('../models/User');
const { generateEmbedding } = require('./embeddingService');

const recommendBooks = async ({ userId, favoriteGenres, limit = 20 }) => {
  console.log('🤖 [RECOMMEND] recommendBooks called with:', {
    userId,
    favoriteGenres,
    limit,
    genresCount: favoriteGenres ? favoriteGenres.length : 0
  });

  let queryVector;
  let source = 'unknown';
  let userFavoritedBookIds = [];

  try {
    // Priority 1: Use favorite books for embedding if available
    if (userId) {
      const user = await User.findById(userId).populate({
        path: 'favoriteBooks',
        select: 'title description subjects genres gutenbergId',
        options: { limit: 5 } // Limit to top 5 favorites for a focused embedding
      });

      if (user && user.favoriteBooks && user.favoriteBooks.length > 0) {
        console.log(`📚 Found ${user.favoriteBooks.length} favorite books for user ${userId}`);
        source = 'embeddings_favorite_books';
        userFavoritedBookIds = user.favoriteBooks.map(book => book.gutenbergId).filter(id => id);

        const combinedText = user.favoriteBooks.map(book => {
          const genres = Array.isArray(book.genres) ? book.genres.join(', ') : '';
          const subjects = Array.isArray(book.subjects) ? book.subjects.join(', ') : '';
          return `${book.title}. ${book.description || ''} Genres: ${genres}. Subjects: ${subjects}.`;
        }).join(" ");
        
        console.log('🔤 Combined favorite books text:', combinedText.substring(0, 200));
        queryVector = await generateEmbedding(combinedText);
      }
    }

    // Priority 2: Fallback to favorite genres
    if (!queryVector && favoriteGenres && favoriteGenres.length > 0) {
      console.log('📖 No favorite books with data, falling back to genres.');
      source = 'embeddings_genres';
      const combinedText = Array.isArray(favoriteGenres) ? favoriteGenres.join(" ") : String(favoriteGenres);
      console.log('🔤 Combined query text:', combinedText.substring(0, 100));
      queryVector = await generateEmbedding(combinedText);
    }
    
    // If no data to generate a vector, return empty
    if (!queryVector) {
      console.log('⚠️ No favorite genres or books provided');
      return { books: [], source: 'no_genres_or_favorites' };
    }

    console.log(`✅ Generated embedding with ${queryVector.length} dimensions`);

    // Search in Qdrant with the embedding
    console.log('🔍 Searching Qdrant for similar embeddings...');
    const searchParams = {
      vector: queryVector,
      limit: 100, // Get more results for filtering
      with_payload: true,
      score_threshold: 0.2, // Adjust threshold as needed
    };

    if (userFavoritedBookIds && userFavoritedBookIds.length > 0) {
      searchParams.filter = {
        must_not: [
          // Exclude books the user has already favorited from recommendations
          { key: "gutenbergId", match: { any: userFavoritedBookIds } }
        ]
      };
      console.log(`🔍 Applying filter to exclude ${userFavoritedBookIds.length} favorited books.`);
    }

    const searchResults = await qdrant.search("books_metadata", searchParams);

    console.log(`📊 Found ${searchResults.length} results from Qdrant`);
    
    if (searchResults.length === 0) {
      console.log('⚠️ No results from Qdrant');
      return { books: [], source: 'no_qdrant_results' };
    }
    
    // Extract and validate book IDs
    const validBookIds = [];
    searchResults.forEach((result) => {
      const payload = result.payload || {};
      const bookId = payload.gutenbergId || payload.book_id || payload._id;
      
      if (bookId && bookId !== 'undefined' && bookId !== 'null') {
        validBookIds.push({
          id: bookId,
          score: result.score || 0,
          isGutenbergId: !isNaN(bookId) && bookId.toString().length < 8
        });
      }
    });
    
    console.log(`📚 Extracted ${validBookIds.length} valid book IDs`);
    
    const gutenbergIds = validBookIds.filter(item => item.isGutenbergId).map(item => item.id);
    const mongoIds = validBookIds.filter(item => !item.isGutenbergId).map(item => item.id);
    
    console.log(`🔢 Gutenberg IDs: ${gutenbergIds.length}, MongoDB IDs: ${mongoIds.length}`);
    
    let books = [];
    
    if (gutenbergIds.length > 0) {
      console.log('🔍 Searching books by gutenbergId...');
      books = await Book.find({ gutenbergId: { $in: gutenbergIds } })
        .select('title author coverImageUrl gutenbergId subjects genres downloadCount generated_blurb description')
        .limit(limit * 2);
      console.log(`✅ Found ${books.length} books by gutenbergId`);
    }
    
    if (books.length < limit && mongoIds.length > 0) {
      console.log('🔍 Searching books by MongoDB _id...');
      const booksByMongoId = await Book.find({ _id: { $in: mongoIds } })
        .select('title author coverImageUrl gutenbergId subjects genres downloadCount generated_blurb description')
        .limit(limit - books.length);
      
      books = [...books, ...booksByMongoId];
      console.log(`✅ Now have ${books.length} total books`);
    }
    
    // Sort books by Qdrant similarity score
    const sortedBooks = books.sort((a, b) => {
      const scoreA = validBookIds.find(item => 
        (item.isGutenbergId && item.id.toString() === a.gutenbergId?.toString()) ||
        (!item.isGutenbergId && item.id.toString() === a._id.toString())
      )?.score || 0;
      
      const scoreB = validBookIds.find(item => 
        (item.isGutenbergId && item.id.toString() === b.gutenbergId?.toString()) ||
        (!item.isGutenbergId && item.id.toString() === b._id.toString())
      )?.score || 0;
      
      return scoreB - scoreA;
    });
    
    const finalBooks = sortedBooks.slice(0, limit);
    console.log(`🎯 Returning ${finalBooks.length} books from source: ${source}`);
    
    return { 
      books: finalBooks,
      source: source,
      qdrantResults: searchResults.length,
      userGenres: favoriteGenres
    };
    
  } catch (error) {
    console.error('❌ Error in recommendBooks:', error.message);
    console.error('Stack:', error.stack);
    return { 
      books: [], 
      source: 'error',
      error: error.message 
    };
  }
};

module.exports = { recommendBooks };