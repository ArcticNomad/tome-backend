// backend/services/userBooksService.js - SIMPLIFIED
const Review = require('../models/Review');
const Book = require('../models/Book');
const { recommendBooks } = require('./recommendService');

/**
 * Get personalized recommendations based on user's highly-rated books
 */
const getBecauseYouLikedRecommendations = async (firebaseUid, limit = 10) => {
  console.log(`🎯 Getting recommendations for user: ${firebaseUid}`);
  
  try {
    if (!firebaseUid) return { books: [], source: 'no_user' };
    
    // 1. Get user's best-rated books
    const userReviews = await Review.find({
      userId: firebaseUid,
      rating: { $gte: 4 }
    })
    .sort({ rating: -1, createdAt: -1 })
    .lean();
    
    if (userReviews.length === 0) {
      return { 
        books: [], 
        source: 'no_ratings', 
        message: 'Rate books 4+ stars to get personalized recommendations!' 
      };
    }
    
    // 2. Pick a source book (simple rotation)
    const selectedReview = pickSourceBook(userReviews);
    const sourceBook = await Book.findOne({ gutenbergId: parseInt(selectedReview.bookId) })
      .select('title gutenbergId author subjects coverImageUrl')
      .lean();
    
    if (!sourceBook) return { books: [], source: 'book_not_found' };
    
    // 3. Find similar books
    const searchTerms = getSearchTerms(sourceBook);
    const { books: similarBooks } = await recommendBooks(searchTerms, limit + 5);
    
    // 4. Filter out books user already rated
    const userBookIds = userReviews.map(r => parseInt(r.bookId));
    const filteredBooks = similarBooks.filter(b => 
      b.gutenbergId !== sourceBook.gutenbergId && 
      !userBookIds.includes(b.gutenbergId)
    ).slice(0, limit);
    
    // 5. Return results
    return {
      books: filteredBooks,
      source: 'embeddings',
      sourceBook: {
        title: sourceBook.title,
        author: sourceBook.author,
        rating: selectedReview.rating,
        coverImageUrl: sourceBook.coverImageUrl
      },
      message: `Because you loved "${sourceBook.title}"`
    };
    
  } catch (error) {
    console.error('❌ Recommendation error:', error);
    
    // Simple fallback
    const popularBooks = await Book.find()
      .sort({ downloadCount: -1 })
      .limit(limit)
      .select('title author coverImageUrl gutenbergId')
      .lean();
    
    return {
      books: popularBooks,
      source: 'fallback',
      message: 'Popular books you might like'
    };
  }
};

/**
 * Simple rotation: pick next book from user's list
 */
const userRotationCache = new Map();

function pickSourceBook(userReviews) {
  // Group by rating
  const fiveStar = userReviews.filter(r => r.rating === 5);
  const fourStar = userReviews.filter(r => r.rating === 4);
  const allBooks = [...fiveStar, ...fourStar];
  
  // Simple rotation using user's Firebase UID as key
  const rotationKey = 'last_book_index';
  const lastIndex = userRotationCache.get(rotationKey) || 0;
  const nextIndex = (lastIndex + 1) % allBooks.length;
  
  userRotationCache.set(rotationKey, nextIndex);
  return allBooks[lastIndex] || allBooks[0];
}

/**
 * Extract search terms from book
 */
function getSearchTerms(book) {
  const terms = [];
  
  // Add title (first 3 words)
  const titleWords = book.title.split(' ').slice(0, 3).filter(w => w.length > 2);
  terms.push(...titleWords);
  
  // Add author's last name
  if (book.author) {
    const authorName = book.author.split(',')[0] || book.author.split(' ')[0];
    if (authorName) terms.push(authorName.trim());
  }
  
  // Add main subject
  if (book.subjects?.[0]) {
    const mainSubject = book.subjects[0].split('--')[0].split(':')[0];
    if (mainSubject && mainSubject.length > 3) {
      terms.push(mainSubject.trim());
    }
  }
  
  // Remove duplicates and filter short terms
  return [...new Set(terms)].filter(t => t && t.length > 2);
}

/**
 * Alternative: Even simpler version without rotation
 */
const getSimpleRecommendations = async (firebaseUid, limit = 10) => {
  try {
    // Get user's single best-rated book
    const bestReview = await Review.findOne({ 
      userId: firebaseUid, 
      rating: { $gte: 4 } 
    })
    .sort({ rating: -1, createdAt: -1 })
    .lean();
    
    if (!bestReview) return { books: [], message: 'Rate some books!' };
    
    // Find similar books
    const { books } = await recommendBooks([bestReview.bookId], limit);
    
    return {
      books: books.slice(0, limit),
      message: `Recommended based on your reading`
    };
    
  } catch (error) {
    console.error(error);
    return { books: [] };
  }
};

module.exports = {
  getBecauseYouLikedRecommendations,
  getSimpleRecommendations
};