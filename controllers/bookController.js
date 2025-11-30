// backend/controllers/bookController.js
const Book = require('../models/Book');

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

// Get recently added books - FIXED
const getRecentlyAdded = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

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

// Get popular books - FIXED
const getPopularBooks = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log('🔥 Getting popular books...');

    const books = await Book.find({ 
      isAvailable: true
    })
    .sort({ downloadCount: -1 }) // Sort by download count descending
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

// backend/controllers/bookController.js - Fix fantasy books function
const getFantasyBooks = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log('🧙‍♂️ Getting fantasy books...');

    // More comprehensive fantasy search terms
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

    // Build a more flexible query
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

// Get featured books for bento grid - FIXED
const getFeaturedBooks = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

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

// Get books by genre/category - FIXED
const getBooksByGenre = async (req, res) => {
  try {
    const { genre } = req.params;
    const { limit = 10 } = req.query;

    console.log(`📖 Getting ${genre} books...`);

    // Map frontend genres to search terms
    const genreMap = {
      'Fiction': ['fiction', 'novel', 'story', 'literature'],
      'Science Fiction': ['science fiction', 'sci-fi', 'future', 'space', 'alien'],
      'Mystery': ['mystery', 'detective', 'crime', 'thriller', 'suspense'],
      'Romance': ['romance', 'love', 'relationship', 'dating'],
      'History': ['history', 'historical', 'war', 'biography', 'ancient'],
      'Biography': ['biography', 'autobiography', 'memoir', 'life story'],
      'Science': ['science', 'technology', 'physics', 'chemistry', 'biology'],
      'Philosophy': ['philosophy', 'philosophical', 'ethics', 'morality'],
      'Adventure': ['adventure', 'action', 'exploration', 'journey'],
      'Horror': ['horror', 'ghost', 'supernatural', 'terror', 'fear']
    };

    const searchTerms = genreMap[genre] || [genre.toLowerCase()];

    const books = await Book.find({
      isAvailable: true,
      $or: searchTerms.map(term => ({
        $or: [
          { subjects: { $in: [new RegExp(term, 'i')] } },
          { title: { $regex: term, $options: 'i' } },
          { summary: { $regex: term, $options: 'i' } }
        ]
      }))
    })
    .sort({ downloadCount: -1 })
    .limit(parseInt(limit))
    .select('title author coverImageUrl downloadCount gutenbergId subjects');

    console.log(`✅ Found ${books.length} ${genre} books`);
    
    res.json({
      success: true,
      data: books,
      genre: genre
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

// Get highly reviewed books - FIXED
const getHighlyReviewedBooks = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    console.log('🌟 Getting highly reviewed books...');

    const books = await Book.find({
      isAvailable: true
    })
    .sort({ downloadCount: -1 }) // Use download count as proxy for popularity
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

// Get book statistics for homepage - FIXED
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
        recentAdditions: totalBooks, // Simplified
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

module.exports = {
  getAllBooks,
  getRecentlyAdded,
  getPopularBooks,
  getFantasyBooks,
  getFeaturedBooks,
  getBooksByGenre,
  getHighlyReviewedBooks,
  getHomepageStats
};