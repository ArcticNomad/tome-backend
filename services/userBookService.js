// backend/services/userBooksService.js - WITH BOOK ROTATION
const Review = require('../models/Review');
const Book = require('../models/Book');
const { recommendBooks } = require('./recommendService');

// Store last used book per user (simple in-memory cache for rotation)
const lastUsedBooks = new Map();

/**
 * Get user's highest rated books with intelligent selection and rotation
 */
const getBecauseYouLikedRecommendations = async (firebaseUid, limit = 10) => {
  console.log('🎯 [BECAUSE YOU LIKED] Getting recommendations with rotation...');
  
  try {
    if (!firebaseUid) {
      console.log('⚠️ No user ID provided');
      return { books: [], source: 'no_user' };
    }
    
    // Step 1: Get ALL user's highly rated books (4+ stars), sorted by rating
    const userReviews = await Review.find({
      userId: firebaseUid,
      rating: { $gte: 4 }
    })
    .sort({ rating: -1, createdAt: -1 }) // Sort by rating first, then recent
    .lean();
    
    console.log(` Found ${userReviews.length} highly-rated books by user`);
    
    if (userReviews.length === 0) {
      console.log(' User has no highly-rated books (4+ stars)');
      return { 
        books: [], 
        source: 'no_ratings', 
        message: 'Rate some books 4+ stars to get personalized recommendations!' 
      };
    }
    
    // Step 2: Group reviews by book and get highest rating for each book
    const bookRatings = {};
    userReviews.forEach(review => {
      const bookId = review.bookId;
      // Keep the highest rating for each book
      if (!bookRatings[bookId] || review.rating > bookRatings[bookId].rating) {
        bookRatings[bookId] = {
          rating: review.rating,
          review: review,
          lastUsed: lastUsedBooks.get(`${firebaseUid}:${bookId}`) || 0
        };
      }
    });
    
    // Convert to array and sort by: 
    // 1. Rating (5 stars first)
    // 2. How recently it was used (less recently used first)
    // 3. Review date (newer first)
    const sortedBooks = Object.entries(bookRatings)
      .map(([bookId, data]) => ({
        bookId,
        rating: data.rating,
        review: data.review,
        lastUsed: data.lastUsed,
        priority: data.rating * 100 - data.lastUsed // 5-star = 500, minus usage count
      }))
      .sort((a, b) => b.priority - a.priority); // Higher priority first
    
    console.log(' Available highly-rated books:');
    sortedBooks.forEach((book, i) => {
      console.log(`  ${i + 1}. Book ID: ${book.bookId}, Rating: ${book.rating}/5, Last Used: ${book.lastUsed}`);
    });
    
    // Step 3: Select a book (prefer 5-star, rotate through options)
    let selectedBook = null;
    let selectedReview = null;
    
    // Try to find a 5-star book that hasn't been used recently
    const fiveStarBooks = sortedBooks.filter(b => b.rating === 5);
    if (fiveStarBooks.length > 0) {
      // If user has multiple 5-star books, rotate through them
      const leastRecentlyUsed = fiveStarBooks.sort((a, b) => a.lastUsed - b.lastUsed)[0];
      selectedBook = leastRecentlyUsed;
      console.log(`⭐ Selected 5-star book (ID: ${selectedBook.bookId}), used ${selectedBook.lastUsed} times`);
    } else {
      // Use the highest priority 4-star book
      selectedBook = sortedBooks[0];
      console.log(`⭐ Selected 4-star book (ID: ${selectedBook.bookId}), rating: ${selectedBook.rating}/5`);
    }
    
    selectedReview = selectedBook.review;
    
    // Update usage count for this user+book combination
    const usageKey = `${firebaseUid}:${selectedBook.bookId}`;
    lastUsedBooks.set(usageKey, (lastUsedBooks.get(usageKey) || 0) + 1);
    
    // Step 4: Get the book details from database
    const gutenbergId = parseInt(selectedBook.bookId);
    
    if (isNaN(gutenbergId)) {
      console.log(`❌ Invalid gutenbergId: ${selectedBook.bookId}`);
      return { books: [], source: 'invalid_id' };
    }
    
    const sourceBook = await Book.findOne({ gutenbergId })
      .select('title gutenbergId author subjects coverImageUrl downloadCount generated_blurb')
      .lean();
    
    if (!sourceBook) {
      console.log(`❌ Book not found for gutenbergId: ${gutenbergId}`);
      return { books: [], source: 'book_not_found' };
    }
    
    console.log(`🎲 Selected book: "${sourceBook.title}" by ${sourceBook.author} (Rating: ${selectedBook.rating}/5)`);
    console.log(`📚 Subjects: ${sourceBook.subjects?.slice(0, 3).join(', ') || 'No subjects'}`);
    
    // Step 5: Create search query from book metadata
    const searchTerms = createSearchTermsFromBook(sourceBook, selectedReview);
    console.log(`🔍 Qdrant search terms: ${searchTerms.join(', ')}`);
    
    // Step 6: Use embeddings to find similar books
    const { books: similarBooks } = await recommendBooks(searchTerms, limit + 5);
    
    // Step 7: Filter out the source book AND other books the user has already rated highly
    const userRatedGutenbergIds = sortedBooks.map(b => parseInt(b.bookId)).filter(id => !isNaN(id));
    
    const filteredBooks = similarBooks.filter(book => 
      book.gutenbergId !== sourceBook.gutenbergId && 
      !userRatedGutenbergIds.includes(book.gutenbergId)
    );
    
    console.log(`✅ Found ${filteredBooks.length} similar books (excluding user's rated books)`);
    
    // Step 8: If not enough similar books, supplement
    let finalBooks = filteredBooks;
    
    if (filteredBooks.length < 5) {
      console.log('🔄 Supplementing with popular books in similar categories...');
      const supplementalBooks = await getSupplementalBooks(
        sourceBook, 
        limit - filteredBooks.length, 
        [...filteredBooks.map(b => b.gutenbergId), ...userRatedGutenbergIds]
      );
      finalBooks = [...filteredBooks, ...supplementalBooks];
    }
    
    console.log(`🎯 Final: ${finalBooks.length} books to return`);
    
    // Step 9: Track which books we've recommended (for rotation)
    trackRecommendedBooks(firebaseUid, finalBooks);
    
    return {
      books: finalBooks.slice(0, limit),
      source: 'qdrant_embeddings',
      sourceBook: {
        title: sourceBook.title,
        author: sourceBook.author,
        rating: selectedBook.rating,
        gutenbergId: sourceBook.gutenbergId,
        coverImageUrl: sourceBook.coverImageUrl,
        subjects: sourceBook.subjects?.slice(0, 3) || [],
        downloadCount: sourceBook.downloadCount || 0
      },
      message: getRecommendationMessage(sourceBook, selectedBook.rating, selectedReview.title),
      availableBooksCount: sortedBooks.length,
      rotationIndex: sortedBooks.findIndex(b => b.bookId === selectedBook.bookId) + 1
    };
    
  } catch (error) {
    console.error('❌ Error in getBecauseYouLikedRecommendations:', error.message);
    console.error('Stack:', error.stack);
    
    // Fallback to popular books
    const popularBooks = await Book.find()
      .sort({ downloadCount: -1 })
      .limit(10)
      .select('title author coverImageUrl gutenbergId downloadCount')
      .lean();
    
    return {
      books: popularBooks,
      source: 'error_fallback',
      message: 'Popular books you might like'
    };
  }
};

/**
 * Create search terms from book metadata
 */
function createSearchTermsFromBook(book, review) {
  const terms = new Set();
  
  // 1. Title words (first 4 words)
  const titleWords = book.title.split(' ').slice(0, 4);
  titleWords.forEach(word => {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (cleanWord.length > 2) {
      terms.add(cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1));
    }
  });
  
  // 2. Author's last name
  if (book.author) {
    const authorLastName = book.author.split(',')[0]?.trim();
    if (authorLastName && authorLastName.length > 1) {
      terms.add(authorLastName);
    }
  }
  
  // 3. Subjects (cleaned up)
  if (book.subjects && book.subjects.length > 0) {
    book.subjects.slice(0, 3).forEach(subject => {
      const cleanSubject = subject
        .split('--')[0]
        .split(':')[0]
        .trim()
        .split(' ')
        .slice(0, 3)
        .join(' ');
      
      if (cleanSubject && cleanSubject.length > 3) {
        terms.add(cleanSubject);
      }
    });
  }
  
  // 4. Genre keywords from title
  const titleLower = book.title.toLowerCase();
  const genreKeywords = {
    'romance|love|passion': 'Romance',
    'mystery|detective|crime|suspense': 'Mystery',
    'fantasy|magic|fairy|wizard|dragon': 'Fantasy',
    'adventure|quest|journey|expedition': 'Adventure',
    'history|historical': 'Historical',
    'science.*fiction|sci.*fi': 'Science Fiction',
    'horror|ghost|gothic|haunted': 'Horror',
    'drama|tragedy|play|theater': 'Drama',
    'comedy|humor|funny|satire': 'Comedy',
    'philosophy|philosophical|thought': 'Philosophy',
    'biography|memoir|autobiography': 'Biography',
    'poetry|poem|verse': 'Poetry'
  };
  
  Object.entries(genreKeywords).forEach(([keywords, genre]) => {
    const regex = new RegExp(keywords);
    if (regex.test(titleLower)) {
      terms.add(genre);
    }
  });
  
  // 5. From review title if available
  if (review.title && review.title.length > 2) {
    const reviewWords = review.title.split(' ').slice(0, 3);
    reviewWords.forEach(word => {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (cleanWord.length > 3) {
        terms.add(cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1));
      }
    });
  }
  
  // 6. Add "Classic" for popular books
  if (book.downloadCount > 50000) {
    terms.add('Classic');
  }
  
  return Array.from(terms).filter(term => term && term.length > 2);
}

/**
 * Get supplemental books when embeddings don't return enough
 */
async function getSupplementalBooks(sourceBook, limit, excludeIds = []) {
  try {
    // Try to find books with similar subjects
    if (sourceBook.subjects && sourceBook.subjects.length > 0) {
      // Use the most distinctive subject (not "Fiction" or similar)
      const distinctiveSubjects = sourceBook.subjects.filter(s => 
        !s.toLowerCase().includes('fiction') && 
        !s.toLowerCase().includes('literature') &&
        s.split(' ').length < 4
      );
      
      const searchSubject = distinctiveSubjects[0] || sourceBook.subjects[0];
      const subjectKeyword = searchSubject.split(' ')[0];
      
      if (subjectKeyword && subjectKeyword.length > 2) {
        const regex = new RegExp(subjectKeyword, 'i');
        
        const supplemental = await Book.find({
          $and: [
            {
              $or: [
                { subjects: regex },
                { title: regex },
                { author: regex }
              ]
            },
            { gutenbergId: { $nin: excludeIds } }
          ]
        })
        .sort({ downloadCount: -1 })
        .limit(limit)
        .select('title author coverImageUrl gutenbergId downloadCount subjects')
        .lean();
        
        if (supplemental.length > 0) {
          console.log(`📚 Found ${supplemental.length} books by subject: ${subjectKeyword}`);
          return supplemental;
        }
      }
    }
    
    // Fallback: get popular books not by the same author
    const popularBooks = await Book.find({
      gutenbergId: { $nin: excludeIds },
      author: { $ne: sourceBook.author } // Avoid same author
    })
    .sort({ downloadCount: -1 })
    .limit(limit)
    .select('title author coverImageUrl gutenbergId downloadCount')
    .lean();
    
    return popularBooks;
    
  } catch (error) {
    console.error('Error getting supplemental books:', error.message);
    return [];
  }
}

/**
 * Track which books we've recommended (simple memory)
 */
function trackRecommendedBooks(firebaseUid, books) {
  const key = `${firebaseUid}:recommended`;
  const recommended = books.map(b => b.gutenbergId).filter(id => id);
  
  // Store last 20 recommended books per user (in memory)
  const existing = lastUsedBooks.get(key) || [];
  const updated = [...new Set([...existing, ...recommended])].slice(-20);
  lastUsedBooks.set(key, updated);
}

/**
 * Generate personalized recommendation message
 */
function getRecommendationMessage(book, rating, reviewTitle) {
  const messages = [
    `Because you loved "${book.title}"`,
    `Similar to "${book.title}" (your ${rating}/5 star rating)`,
    `If you enjoyed "${book.title}", you might like these`,
    `More like "${book.title}" - based on your ${rating}-star review`,
    `Since you rated "${book.title}" ${rating}/5 stars...`
  ];
  
  // If the review has a title, mention it
  if (reviewTitle && reviewTitle.length > 2) {
    messages.push(`Because you called "${book.title}" "${reviewTitle}"`);
  }
  
  // Randomly select a message
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get the next book in rotation (for testing or manual rotation)
 */
function getNextBookInRotation(firebaseUid) {
  // This would reset the usage counter for the current book
  // In a production app, you'd want to persist this to a database
  console.log(`🔄 Manual rotation requested for user: ${firebaseUid}`);
  // Implementation would depend on your needs
}

module.exports = {
  getBecauseYouLikedRecommendations,
  getNextBookInRotation
};