// backend/services/recommendService.js - Update to return more books
const { qdrant } = require("../config/qdrantConfig");
const Book = require('../models/Book');

let embedder = null;

const initializeEmbedder = async () => {
  if (!embedder) {
    console.log("📥 Loading Xenova embedding model...");
    const { pipeline } = await import("@xenova/transformers");
    embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2");
    console.log("✅ Embedding model loaded");
  }
  return embedder;
};

const generateEmbedding = async (text) => {
  const model = await initializeEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
};

const recommendBooks = async (favoriteGenres, limit = 20) => { // Increased from 10 to 20
  console.log('🤖 [EMBEDDINGS] recommendBooks called with:', favoriteGenres, 'limit:', limit);
  
  if (!favoriteGenres || favoriteGenres.length === 0) {
    console.log('⚠️ No favorite genres provided');
    return { books: [] };
  }

  try {
    const combinedText = favoriteGenres.join(" ");
    console.log('🔤 Combined query text:', combinedText);
    
    // Generate embedding
    const queryVector = await generateEmbedding(combinedText);
    console.log(`✅ Generated embedding with ${queryVector.length} dimensions`);
    
    // Search in Qdrant - INCREASE LIMIT
    console.log('🔍 Searching Qdrant...');
    const searchResults = await qdrant.search("books_metadata", {
      vector: queryVector,
      limit: 100, // Increased from 50 to 100
      with_payload: true,
      score_threshold: 0.1 // Lower threshold to get more results
    });

    console.log(`📊 Found ${searchResults.length} results from Qdrant`);
    
    // Extract book IDs
    const topBookIds = searchResults
      .map(r => r.payload?.book_id || r.payload?.gutenbergId || r.payload?._id)
      .filter(id => id !== undefined && id !== null && id !== 'undefined' && id !== 'null');
    
    console.log(`📚 Extracted ${topBookIds.length} valid book IDs`);
    
    if (topBookIds.length === 0) {
      console.log('⚠️ No valid book IDs found');
      return { books: [] };
    }
    
    // Try to fetch books by gutenbergId
    const numericIds = topBookIds.filter(id => !isNaN(id) && id.toString().length < 8);
    const objectIds = topBookIds.filter(id => id.toString().length === 24);
    
    console.log(`🔢 Numeric IDs: ${numericIds.length}, Object IDs: ${objectIds.length}`);
    
    let books = [];
    
    // Try numeric IDs first (gutenbergId)
    if (numericIds.length > 0) {
      console.log('🔍 Searching by gutenbergId...');
      books = await Book.find(
        { gutenbergId: { $in: numericIds } },
        { title: 1, author: 1, coverImageUrl: 1, gutenbergId: 1, subjects: 1, downloadCount: 1, generated_blurb: 1 }
      ).limit(limit * 2); // Fetch more than needed
      console.log(`✅ Found ${books.length} books by gutenbergId`);
    }
    
    // If not enough books, try ObjectId
    if (books.length < limit && objectIds.length > 0) {
      console.log('🔍 Searching by _id...');
      const moreBooks = await Book.find(
        { _id: { $in: objectIds } },
        { title: 1, author: 1, coverImageUrl: 1, gutenbergId: 1, subjects: 1, downloadCount: 1, generated_blurb: 1 }
      ).limit(limit - books.length);
      
      books = [...books, ...moreBooks];
      console.log(`✅ Now have ${books.length} total books`);
    }
    
    // If still not enough, supplement with popular books in similar genres
    if (books.length < limit) {
      console.log('🔄 Supplementing with popular books in similar genres...');
      const genrePatterns = favoriteGenres.map(genre => 
        new RegExp(genre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      );
      
      const supplementalBooks = await Book.find({
        $or: [
          { subjects: { $in: genrePatterns } },
          { genres: { $in: genrePatterns } }
        ],
        gutenbergId: { $nin: books.map(b => b.gutenbergId) } // Don't include duplicates
      })
      .sort({ downloadCount: -1 })
      .limit(limit - books.length)
      .select('title author coverImageUrl gutenbergId subjects downloadCount generated_blurb');
      
      books = [...books, ...supplementalBooks];
      console.log(`✅ Now have ${books.length} total books after supplementing`);
    }
    
    // Remove duplicates by gutenbergId
    const uniqueBooks = [];
    const seenIds = new Set();
    
    for (const book of books) {
      if (!seenIds.has(book.gutenbergId)) {
        seenIds.add(book.gutenbergId);
        uniqueBooks.push(book);
      }
    }
    
    // Take only the requested limit
    const finalBooks = uniqueBooks.slice(0, limit);
    
    console.log(`🎯 Returning ${finalBooks.length} unique books from embeddings`);
    return { books: finalBooks };
    
  } catch (error) {
    console.error('❌ Error in recommendBooks:', error.message);
    console.error('Stack:', error.stack);
    return { books: [] };
  }
};

module.exports = { recommendBooks, generateEmbedding };