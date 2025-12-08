// backend/services/recommendService.js
const { qdrant } = require("../config/qdrantConfig");
const Book = require('../models/Book');
const { generateEmbedding } = require('./embeddingService');

const recommendBooks = async (favoriteGenres, limit = 20) => {
  console.log('🤖 [RECOMMEND] recommendBooks called with:', {
    favoriteGenres,
    limit,
    genresCount: favoriteGenres ? favoriteGenres.length : 0
  });
  
  if (!favoriteGenres || favoriteGenres.length === 0) {
    console.log('⚠️ No favorite genres provided');
    return { books: [], source: 'no_genres' };
  }

  try {
    // Prepare text for embedding
    const combinedText = Array.isArray(favoriteGenres) 
      ? favoriteGenres.join(" ") 
      : String(favoriteGenres);
    
    console.log('🔤 Combined query text:', combinedText.substring(0, 100));
    
    // Generate embedding from user's favorite genres
    const queryVector = await generateEmbedding(combinedText);
    console.log(`✅ Generated embedding with ${queryVector.length} dimensions`);
    
    // Search in Qdrant with the embedding
    console.log('🔍 Searching Qdrant for similar embeddings...');
    const searchResults = await qdrant.search("books_metadata", {
      vector: queryVector,
      limit: 100, // Get more results for filtering
      with_payload: true,
      score_threshold: 0.2 // Adjust threshold as needed
    });

    console.log(`📊 Found ${searchResults.length} results from Qdrant`);
    
    if (searchResults.length === 0) {
      console.log('⚠️ No results from Qdrant');
      return { books: [], source: 'no_qdrant_results' };
    }
    
    // Extract and validate book IDs
    const validBookIds = [];
    searchResults.forEach((result, index) => {
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
    
    // Separate gutenbergIds and MongoDB ObjectIds
    const gutenbergIds = validBookIds
      .filter(item => item.isGutenbergId)
      .map(item => item.id);
    
    const mongoIds = validBookIds
      .filter(item => !item.isGutenbergId)
      .map(item => item.id);
    
    console.log(`🔢 Gutenberg IDs: ${gutenbergIds.length}, MongoDB IDs: ${mongoIds.length}`);
    
    let books = [];
    
    // Try to fetch books by gutenbergId first (most common)
    if (gutenbergIds.length > 0) {
      console.log('🔍 Searching books by gutenbergId...');
      const booksByGutenberg = await Book.find({
        gutenbergId: { $in: gutenbergIds }
      })
      .select('title author coverImageUrl gutenbergId subjects genres downloadCount generated_blurb description')
      .limit(limit * 2);
      
      books = booksByGutenberg;
      console.log(`✅ Found ${books.length} books by gutenbergId`);
    }
    
    // If not enough, try MongoDB ObjectIds
    if (books.length < limit && mongoIds.length > 0) {
      console.log('🔍 Searching books by MongoDB _id...');
      const booksByMongoId = await Book.find({
        _id: { $in: mongoIds }
      })
      .select('title author coverImageUrl gutenbergId subjects genres downloadCount generated_blurb description')
      .limit(limit - books.length);
      
      books = [...books, ...booksByMongoId];
      console.log(`✅ Now have ${books.length} total books`);
    }
    
    // Sort books by Qdrant similarity score (if possible)
    const sortedBooks = books.sort((a, b) => {
      const scoreA = validBookIds.find(item => 
        item.id.toString() === a.gutenbergId?.toString() || 
        item.id.toString() === a._id.toString()
      )?.score || 0;
      
      const scoreB = validBookIds.find(item => 
        item.id.toString() === b.gutenbergId?.toString() || 
        item.id.toString() === b._id.toString()
      )?.score || 0;
      
      return scoreB - scoreA;
    });
    
    // Take only the requested limit
    const finalBooks = sortedBooks.slice(0, limit);
    
    console.log(`🎯 Returning ${finalBooks.length} books from embeddings`);
    
    return { 
      books: finalBooks,
      source: 'embeddings',
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