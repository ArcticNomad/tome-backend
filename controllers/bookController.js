// backend/controllers/bookController.js
const Book = require('../models/Book');
const mongoose = require('mongoose');



const getBookById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📖 Getting book with ID: ${id}`);
    
    let book;
    
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Search by MongoDB _id
      book = await Book.findById(id);
    } else {
      // Search by Gutenberg ID
      book = await Book.findOne({ gutenbergId: id });
      
    
      if (!book) {
        book = await Book.findOne({ _id: id });
      }
    }
    
    if (!book) {
      console.log(`❌ Book not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    console.log(`✅ Found book: ${book.title} by ${book.author}`);
    
    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    console.error('❌ Get book by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching book',
      error: error.message
    });
  }
};

// Get all books with filtering and pagination
const getAllBooks = async (req, res) => {
  try {
    console.log('📚 Getting all books...');
    
    const {
      page = 1,
      limit = 50,
      search,
      author,
      subject,
      sortBy = 'issuedDate',
      sortOrder = 'desc',
      availableOnly = true
    } = req.query;

    // Build query
    let query = {};
    
    if (availableOnly === 'true') {
      query.isAvailable = true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }

    if (author) {
      query.author = { $regex: author, $options: 'i' };
    }

    if (subject) {
      query.subjects = { $in: [new RegExp(subject, 'i')] };
    }

    // Sort options
    const sortOptions = {};
    if (sortBy === 'issuedDate') {
      sortOptions.issuedDate = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'downloadCount') {
      sortOptions.downloadCount = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Execute query with pagination
    const books = await Book.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    // Get total count for pagination
    const total = await Book.countDocuments(query);

    console.log(`✅ Found ${books.length} books`);
    
    res.json({
      success: true,
      data: books,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBooks: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Get books error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching books',
      error: error.message
    });
  }
};

const getBooksWithPagination = async (req, res) => {
  try {
    console.log('📚 Getting books with pagination...');
    
    const {
      page = 1,
      limit = 24,
      search,
      genre,
      category,
      author,
      sortBy = 'downloadCount',
      sortOrder = 'desc',
      availableOnly = true
    } = req.query;

  
    let query = {};
    
    if (availableOnly === 'true') {
      query.isAvailable = true;
    }

  
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { subjects: { $regex: search, $options: 'i' } }
      ];
    }

    // Handle author filter
    if (author) {
      query.author = { $regex: author, $options: 'i' };
    }

    // Handle genre/category filter
    if (genre || category) {
      const searchTerm = genre || category;
      query.subjects = { $regex: searchTerm, $options: 'i' };
    }

    // Special handling for specific categories
    const categoryMap = {
      'Fantasy': 'fantasy|magic|fairy|dragon|wizard',
      'Science Fiction': 'science fiction|sci-fi|space|alien|future',
      'Mystery': 'mystery|detective|crime|suspense',
      'Romance': 'romance|love|relationship',
      'History': 'history|historical|war|biography',
      'Adventure': 'adventure|action|journey|exploration',
      'Horror': 'horror|ghost|supernatural|terror',
      'Philosophy': 'philosophy|ethics|morality',
      'Science': 'science|technology|physics|chemistry',
      'Biography': 'biography|autobiography|memoir'
    };

    if (category && categoryMap[category]) {
      query.subjects = { $regex: categoryMap[category], $options: 'i' };
    }

    const sortOptions = {};
    if (sortBy === 'issuedDate') {
      sortOptions.issuedDate = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'downloadCount') {
      sortOptions.downloadCount = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'title') {
      sortOptions.title = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const books = await Book.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('title author coverImageUrl downloadCount gutenbergId subjects');

    
    const total = await Book.countDocuments(query);

    console.log(`✅ Found ${books.length} books (Page ${page}, Limit ${limit}, Total: ${total})`);
    
    res.json({
      success: true,
      data: books,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBooks: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Get books with pagination error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching books',
      error: error.message
    });
  }
};

const getRecentlyAdded = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    console.log('🆕 Getting recently added books...');

    const books = await Book.find({ 
      isAvailable: true 
    })
    .sort({ createdAt: -1, issuedDate: -1 }) // Use both fields for better results
    .limit(parseInt(limit))
    .select('title author coverImageUrl downloadCount issuedDate gutenbergId subjects summary');

    console.log(`✅ Found ${books.length} recently added books`);
    
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    console.error('Get recently added error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recently added books',
      error: error.message
    });
  }
};

// Get popular books
const getPopularBooks = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    console.log('🔥 Getting popular books...');

    const books = await Book.find({ 
      isAvailable: true
    })
    .sort({ downloadCount: -1 }) 
    .limit(parseInt(limit))
    .select('title author coverImageUrl downloadCount gutenbergId subjects');

    console.log(`✅ Found ${books.length} popular books`);
    
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    console.error('Get popular books error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular books',
      error: error.message
    });
  }
};

const getFantasyBooks = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    console.log('🧙‍♂️ Getting fantasy books...');

    const fantasyKeywords = [
      'fantasy', 'magic', 'fairy', 'myth', 'dragon', 'wizard', 
      'witch', 'sorcery', 'enchanted', 'mythical', 'legend',
      'adventure', 'quest', 'kingdom', 'castle', 'sword', 'dragon',
      'magical', 'supernatural', 'epic', 'hero', 'prophecy',
      'orc', 'elf', 'dwarf', 'goblin', 'troll', 'vampire',
      'werewolf', 'demon', 'angel', 'ghost', 'spell', 'curse',
      'charm', 'potion', 'wand', 'scroll', 'amulet', 'artifact'
      ,'Monsters','Fiction','Dark Fantasy','High Fantasy','Urban Fantasy'
    ];

    const books = await Book.find({
      isAvailable: true,
      $or: [
        // Search in subjects array
        { 
          subjects: { 
            $in: fantasyKeywords.map(keyword => 
              new RegExp(keyword, 'i')
            ) 
          } 
        },
        // Search in title
        { 
          title: { 
            $regex: fantasyKeywords.join('|'), 
            $options: 'i' 
          } 
        },
        // Search in summary
        { 
          summary: { 
            $regex: fantasyKeywords.join('|'), 
            $options: 'i' 
          } 
        }
      ]
    })
    .limit(parseInt(limit))
    .select('title author coverImageUrl downloadCount gutenbergId subjects summary');

    console.log(`✅ Found ${books.length} fantasy books`);
    
    // If no fantasy books found, return some popular books as fallback
    if (books.length === 0) {
      console.log('⚠️ No fantasy books found, returning popular books instead');
      const popularBooks = await Book.find({
        isAvailable: true
      })
      .sort({ downloadCount: -1 })
      .limit(parseInt(limit))
      .select('title author coverImageUrl downloadCount gutenbergId subjects summary');
      
      return res.json({
        success: true,
        data: popularBooks,
        message: 'No fantasy books found, showing popular books instead'
      });
    }
    
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    console.error('Get fantasy books error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fantasy books',
      error: error.message
    });
  }
};

// Get featured books for bento grid
const getFeaturedBooks = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    console.log('⭐ Getting featured books...');

    const featuredBooks = await Book.find({
      isAvailable: true
    })
    .sort({ downloadCount: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .select('title author coverImageUrl downloadCount gutenbergId subjects summary readingEaseScore');

    console.log(`✅ Found ${featuredBooks.length} featured books`);
    
    res.json({
      success: true,
      data: featuredBooks
    });
  } catch (error) {
    console.error('Get featured books error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured books',
      error: error.message
    });
  }
};


const getBooksByGenre = async (req, res) => {
  try {
    const { genre } = req.params;
    const { limit = 20 } = req.query;

    console.log(`📖 Getting ${genre} books...`);

    const genreMap = {
      'Fiction': ['fiction', 'novel', 'story', 'literature'],
      'Science Fiction': ['science fiction', 'sci-fi', 'sf', 'space opera', 'cyberpunk', 'future', 'space', 'alien', 'robot', 'android', 'dystopia'],
      'Sci-Fi': ['science fiction', 'sci-fi', 'sf', 'space', 'alien', 'robot', 'future', 'technology'],
      'Fantasy': ['fantasy', 'magic', 'fairy', 'myth', 'dragon', 'wizard', 'witch', 'sorcery', 'enchanted', 'mythical'],
      'Mystery': ['mystery', 'detective', 'crime', 'suspense', 'investigation', 'whodunit'],
      'Thriller': ['thriller', 'suspense', 'espionage', 'conspiracy', 'action', 'psychological thriller'],
      'Romance': ['romance', 'love', 'relationship', 'dating', 'courtship', 'marriage'],
      'History': ['history', 'historical', 'war', 'biography', 'ancient', 'medieval', 'renaissance'],
      'Biography': ['biography', 'autobiography', 'memoir', 'life story', 'diary'],
      'Science': ['science', 'technology', 'physics', 'chemistry', 'biology', 'mathematics', 'astronomy'],
      'Philosophy': ['philosophy', 'philosophical', 'ethics', 'morality', 'logic', 'metaphysics'],
      'Adventure': ['adventure', 'action', 'exploration', 'journey', 'expedition', 'quest'],
      'Horror': ['horror', 'ghost', 'supernatural', 'terror', 'fear', 'haunted', 'monster']
    };


    let searchTerms = genreMap[genre] || [genre.toLowerCase()];
    
    console.log(`🔍 Search terms for ${genre}:`, searchTerms);

   
    const books = await Book.find({
      isAvailable: true,
      $or: [
        // Search in subjects array (case-insensitive)
        { 
          subjects: { 
            $in: searchTerms.map(term => new RegExp(term, 'i')) 
          } 
        },
        // Search in title
        { 
          title: { 
            $regex: searchTerms.join('|'), 
            $options: 'i' 
          } 
        },
        // Search in summary
        { 
          summary: { 
            $regex: searchTerms.slice(0, 3).join('|'), 
            $options: 'i' 
          } 
        }
      ]
    })
    .sort({ downloadCount: -1, title: 1 })
    .limit(parseInt(limit))
    .select('title author coverImageUrl downloadCount gutenbergId subjects summary')
    .lean();

    console.log(`✅ Found ${books.length} ${genre} books`);
    
    // If no books found with specific terms, try a broader search
    if (books.length === 0) {
      console.log(`⚠️ No ${genre} books found, trying broader search...`);
      
      const broadSearchBooks = await Book.find({
        isAvailable: true,
        $or: [
          { subjects: { $regex: genre, $options: 'i' } },
          { title: { $regex: genre, $options: 'i' } }
        ]
      })
      .sort({ downloadCount: -1 })
      .limit(parseInt(limit))
      .select('title author coverImageUrl downloadCount gutenbergId subjects summary')
      .lean();
      
      console.log(`✅ Found ${broadSearchBooks.length} books with broader search`);
      
      return res.json({
        success: true,
        data: broadSearchBooks,
        genre: genre,
        searchType: 'broad'
      });
    }
    
    res.json({
      success: true,
      data: books,
      genre: genre,
      searchType: 'specific'
    });
  } catch (error) {
    console.error('Get books by genre error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching books by genre',
      error: error.message
    });
  }
};

const getHighlyReviewedBooks = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    console.log('🌟 Getting highly reviewed books...');

    const books = await Book.find({
      isAvailable: true
    })
    .sort({ downloadCount: -1 }) 
    .limit(parseInt(limit))
    .select('title author coverImageUrl downloadCount gutenbergId subjects');

    console.log(`✅ Found ${books.length} highly reviewed books`);
    
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    console.error('Get highly reviewed books error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching highly reviewed books',
      error: error.message
    });
  }
};


const getHomepageStats = async (req, res) => {
  try {
    console.log('📊 Getting homepage stats...');

    const totalBooks = await Book.countDocuments({ isAvailable: true });
    const totalDownloads = await Book.aggregate([
      { $match: { isAvailable: true } },
      { $group: { _id: null, total: { $sum: '$downloadCount' } } }
    ]);

    // Get some sample books to ensure we have data
    const sampleBooks = await Book.find({ isAvailable: true }).limit(5);

    console.log(`📊 Stats: ${totalBooks} total books, ${sampleBooks.length} sample books found`);
    
    res.json({
      success: true,
      data: {
        totalBooks,
        totalDownloads: totalDownloads[0]?.total || 0,
        recentAdditions: totalBooks,
        sampleBooksCount: sampleBooks.length,
        liveData: true
      }
    });
  } catch (error) {
    console.error('Get homepage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching homepage statistics',
      error: error.message
    });
  }
};


const getRelatedBooks = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔗 Getting related books for: ${id}`);
    
    // Find book by either ObjectId or gutenbergId
    let book;
    
    if (mongoose.Types.ObjectId.isValid(id)) {
      book = await Book.findById(id);
    } else {
   
      book = await Book.findOne({ gutenbergId: id });
    }
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    // Get related books based on subjects/genres
    const relatedBooks = await Book.find({
      $and: [
        { _id: { $ne: book._id } }, // Exclude current book
        { subjects: { $in: book.subjects || [] } } // Match by subjects
      ]
    })
    .limit(20)
    .select('title author coverImageUrl gutenbergId subjects')
    .lean();
    
    console.log(`✅ Found ${relatedBooks.length} related books`);
    
    res.json({
      success: true,
      data: relatedBooks
    });
    
  } catch (error) {
    console.error('❌ Get related books error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching related books',
      error: error.message
    });
  }
};

/**
 * Get book with full text URL
 * This endpoint specifically returns the book with the fullTextUrl added
 */
const getBookWithFullText = async (req, res) => {
  try {
    const { id } = req.params;
    
    let book;
    
    // Check if ID is MongoDB ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      book = await Book.findById(id);
    } else {
      // Try as gutenbergId
      book = await Book.findOne({ gutenbergId: parseInt(id) });
    }
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    // Convert to plain object
    const bookData = book.toObject();
    
    // Add fullTextUrl if gutenbergId exists
    if (bookData.gutenbergId) {
      bookData.fullTextUrl = `https://storage.googleapis.com/book_text_data/books/${bookData.gutenbergId}/full-text.txt`;
    } else {
      // If no gutenbergId, try to construct from book data or return null
      bookData.fullTextUrl = null;
    }
    
    // Also add reading statistics if user is authenticated
    if (req.user && req.user.uid) {
      const User = require('../models/User');
      const user = await User.findOne({ firebaseUid: req.user.uid })
        .select('readingStats bookshelves');
      
      if (user) {
        // Check if book is in user's bookshelves
        const isCurrentlyReading = user.bookshelves.currentlyReading.some(
          item => item.bookId && item.bookId.toString() === bookData._id.toString()
        );
        const isWantToRead = user.bookshelves.wantToRead.some(
          item => item.bookId && item.bookId.toString() === bookData._id.toString()
        );
        const isRead = user.bookshelves.read.some(
          item => item.bookId && item.bookId.toString() === bookData._id.toString()
        );
        
        bookData.userStatus = {
          isCurrentlyReading,
          isWantToRead,
          isRead
        };
      }
    }
    
    res.json({
      success: true,
      data: bookData
    });
  } catch (error) {
    console.error('Get book with full text error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get just the full text URL for a book
 * Useful for direct text fetching
 */
const getFullTextUrl = async (req, res) => {
  try {
    const { id } = req.params;
    
    let book;
    
    // Check if ID is MongoDB ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      book = await Book.findById(id);
    } else {
      // Try as gutenbergId
      book = await Book.findOne({ gutenbergId: parseInt(id) });
    }
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    if (!book.gutenbergId) {
      return res.status(404).json({
        success: false,
        message: 'Full text not available for this book'
      });
    }
    
    const fullTextUrl = `https://storage.googleapis.com/book_text_data/books/${book.gutenbergId}/full-text.txt`;
    
    // Optional: Check if the file exists (makes a HEAD request)
    try {
      const headResponse = await fetch(fullTextUrl, { method: 'HEAD' });
      if (!headResponse.ok) {
        return res.status(404).json({
          success: false,
          message: 'Full text file not found on storage server',
          url: fullTextUrl,
          exists: false
        });
      }
      
      // Get file size if available
      const contentLength = headResponse.headers.get('content-length');
      const fileSize = contentLength ? parseInt(contentLength) : null;
      
      res.json({
        success: true,
        data: {
          url: fullTextUrl,
          exists: true,
          fileSize: fileSize,
          gutenbergId: book.gutenbergId,
          title: book.title,
          author: book.author,
          estimatedPages: fileSize ? Math.ceil(fileSize / 2500) : null // Rough estimate: 2500 chars per page
        }
      });
      
    } catch (fetchError) {
      // If HEAD request fails, still return the URL but mark as possibly unavailable
      res.json({
        success: true,
        data: {
          url: fullTextUrl,
          exists: false,
          gutenbergId: book.gutenbergId,
          title: book.title,
          author: book.author,
          error: 'Could not verify file availability'
        }
      });
    }
    
  } catch (error) {
    console.error('Get full text URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get book content (with pagination support)
 * This fetches the actual text content and returns it paginated
 */
const getBookContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 1000, wordsPerPage = 300 } = req.query;
    
    let book;
    
    // Check if ID is MongoDB ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      book = await Book.findById(id);
    } else {
      // Try as gutenbergId
      book = await Book.findOne({ gutenbergId: parseInt(id) });
    }
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    
    if (!book.gutenbergId) {
      return res.status(404).json({
        success: false,
        message: 'Full text not available for this book'
      });
    }
    
    const fullTextUrl = `https://storage.googleapis.com/book_text_data/books/${book.gutenbergId}/full-text.txt`;
    
    try {
      // Fetch the text content
      const textResponse = await fetch(fullTextUrl);
      
      if (!textResponse.ok) {
        return res.status(404).json({
          success: false,
          message: 'Failed to fetch book content'
        });
      }
      
      const textContent = await textResponse.text();
      
      // Paginate the content
      const words = textContent.split(/\s+/);
      const totalWords = words.length;
      const wordsPerPageNum = parseInt(wordsPerPage);
      const totalPages = Math.ceil(totalWords / wordsPerPageNum);
      
      // Calculate page range
      const pageNum = parseInt(page);
      const startIdx = (pageNum - 1) * wordsPerPageNum;
      const endIdx = Math.min(startIdx + wordsPerPageNum, totalWords);
      
      const pageContent = words.slice(startIdx, endIdx).join(' ');
      const progress = totalPages > 0 ? Math.round((pageNum / totalPages) * 100) : 0;
      
      res.json({
        success: true,
        data: {
          content: pageContent,
          metadata: {
            currentPage: pageNum,
            totalPages: totalPages,
            totalWords: totalWords,
            wordsPerPage: wordsPerPageNum,
            progress: progress,
            hasPrevious: pageNum > 1,
            hasNext: pageNum < totalPages
          },
          bookInfo: {
            id: book._id,
            gutenbergId: book.gutenbergId,
            title: book.title,
            author: book.author
          }
        }
      });
      
    } catch (fetchError) {
      console.error('Fetch book content error:', fetchError);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch book content from storage',
        error: fetchError.message
      });
    }
    
  } catch (error) {
    console.error('Get book content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


module.exports = {
  getAllBooks,
  getRecentlyAdded,
  getPopularBooks,
  getFantasyBooks,
  getFeaturedBooks,
  getBooksByGenre,
  getHighlyReviewedBooks,
  getHomepageStats,
  getBookById,
  getRelatedBooks,
  getBooksWithPagination,
  getBookWithFullText,
  getFullTextUrl,
  getBookContent,
};