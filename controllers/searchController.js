// backend/controllers/searchController.js - FIXED CACHE WITH PAGINATION
const { qdrant } = require("../config/qdrantConfig");
const Book = require("../models/Book");
const { pipeline } = require("@xenova/transformers");

let embedder = null;

const loadEmbedder = async () => {
  if (!embedder) {
    console.log('🤖 Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
    console.log('✅ Embedding model loaded');
  }
  return embedder;
};

const generateEmbedding = async (text) => {
  const model = await loadEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
};

// FIXED CACHE IMPLEMENTATION WITH PAGINATION
const semanticCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Get paginated semantic results for a query
// backend/controllers/searchController.js - FIXED getSemanticResults
const getSemanticResults = async (query, page = 1, limit = 24) => {
  const cacheKey = `${query.toLowerCase()}_${page}_${limit}`;
  
  // Check cache
  if (semanticCache.has(cacheKey)) {
    const cached = semanticCache.get(cacheKey);
    if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📦 Using cached semantic results for: "${query}" page ${page}`);
      return cached.results || { items: [], total: 0 };
    }
  }
  
  console.log(`🔍 Getting semantic results for: "${query}" - Page ${page}, Limit ${limit}`);
  
  try {
    const queryEmbedding = await generateEmbedding(query);
    const offset = (page - 1) * limit;
    
    // Get paginated results directly from Qdrant
    const qdrantResults = await qdrant.search("books_metadata", {
      vector: queryEmbedding,
      limit: limit,
      offset: offset,
      with_payload: true,
      score_threshold: 0.15,
      with_vector: false
    });

    // FIX: Get ALL results for accurate total count (but with payload to extract IDs)
    const totalResultsResponse = await qdrant.search("books_metadata", {
      vector: queryEmbedding,
      limit: 1000, // Increase limit for better total estimation
      with_payload: true,  // CRITICAL: Need payload to get book IDs
      score_threshold: 0.15,
      with_vector: false
    });

    // Extract book IDs with scores for this page
    const semanticItems = [];
    const seenIds = new Set();
    
    qdrantResults.forEach((result, index) => {
      const payload = result.payload;
      if (payload?.book_id && !seenIds.has(payload.book_id)) {
        seenIds.add(payload.book_id);
        semanticItems.push({
          bookId: payload.book_id,
          score: result.score || 0.5,
          rank: offset + index + 1
        });
      }
    });

    // FIX: Calculate total unique books from ALL semantic results
    const allSeenIds = new Set();
    totalResultsResponse.forEach(result => {
      if (result.payload?.book_id) {
        allSeenIds.add(result.payload.book_id);
      }
    });
    
    const totalUnique = allSeenIds.size;
    console.log(`📊 Found ${totalUnique} unique books in semantic search`);

    const results = {
      items: semanticItems,
      total: totalUnique,
      page: page,
      limit: limit,
      offset: offset
    };
    
    // Cache with TTL
    semanticCache.set(cacheKey, {
      results: results,
      timestamp: Date.now()
    });
    
    console.log(`📚 Found ${semanticItems.length} semantic books for page ${page} (total: ${totalUnique})`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Error getting semantic results:', error.message);
    return { items: [], total: 0, page: page, limit: limit };
  }
};
const hybridSearch = async (req, res) => {
  try {
    const { query, limit = 24, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(parseInt(limit), 100));
    const offset = (pageNum - 1) * limitNum;

    console.log(`🔍 Hybrid search for: "${query}" - Page ${pageNum}, Limit ${limitNum}`);

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    // 1. Get paginated keyword results for THIS PAGE
    let keywordItems = [];
    let keywordTotal = 0;
    try {
      console.log(`🔤 Getting keyword results for page ${pageNum}: "${query}"`);
      
      keywordItems = await Book.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { author: { $regex: query, $options: 'i' } },
          { subjects: { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } }
        ]
      })
      .skip(offset)
      .limit(limitNum)
      .select('title author coverImageUrl gutenbergId downloadCount subjects summary _id')
      .lean();

      // Get total count for pagination
      keywordTotal = await Book.countDocuments({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { author: { $regex: query, $options: 'i' } },
          { subjects: { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } }
        ]
      });

      console.log(`📖 Page ${pageNum}: ${keywordItems.length} keyword matches (total: ${keywordTotal})`);

    } catch (err) {
      console.error('❌ Keyword search error:', err.message);
    }

    // 2. Get paginated semantic results for THIS PAGE (with cache per page)
    const semanticData = await getSemanticResults(query, pageNum, limitNum);
    const semanticItems = semanticData.items || [];
    const semanticTotal = semanticData.total || 0;
    
    console.log(`🤖 Page ${pageNum}: ${semanticItems.length} semantic matches (total: ${semanticTotal})`);

    // 3. Get book details for semantic items
    let semanticBooks = [];
    if (semanticItems.length > 0) {
      const semanticIds = semanticItems.map(item => item.bookId);
      
      const books = await Book.find({
        _id: { $in: semanticIds }
      })
      .select('title author coverImageUrl gutenbergId downloadCount subjects summary _id')
      .lean();

      // Map scores and maintain order
      const scoreMap = new Map();
      semanticItems.forEach(item => {
        scoreMap.set(item.bookId, {
          score: item.score,
          rank: item.rank
        });
      });

      semanticBooks = books.map(book => {
        const bookId = book._id.toString();
        const scoreInfo = scoreMap.get(bookId);
        return {
          ...book,
          _semanticScore: scoreInfo?.score || 0.5,
          _semanticRank: scoreInfo?.rank || 0
        };
      }).sort((a, b) => a._semanticRank - b._semanticRank);
    }

    // 4. COMBINE results with deduplication for THIS PAGE
    const seenIds = new Set();
    const combinedBooks = [];

    // Add semantic books first (higher priority)
    semanticBooks.forEach(book => {
      const key = book.gutenbergId || book._id.toString();
      if (!seenIds.has(key)) {
        seenIds.add(key);
        combinedBooks.push(book);
      }
    });

    // Add keyword books (lower priority) - only if we have space
    for (const book of keywordItems) {
      if (combinedBooks.length >= limitNum) break;
      
      const key = book.gutenbergId || book._id.toString();
      if (!seenIds.has(key)) {
        seenIds.add(key);
        combinedBooks.push(book);
      }
    }

    console.log(`🎯 Page ${pageNum}: ${combinedBooks.length} combined books`);

    // 5. CALCULATE ACCURATE TOTAL COUNT (combination of both sources)
    // This is approximate but good enough for pagination
   // In hybridSearch function, replace the total calculation section:
// 5. CALCULATE ACCURATE TOTAL COUNT (combination of both sources)
const estimatedTotal = Math.max(keywordTotal, semanticTotal);
const totalBooks = estimatedTotal > 0 ? estimatedTotal : 0;
const totalPages = totalBooks > 0 ? Math.ceil(totalBooks / limitNum) : 1;

console.log(`📊 Total books: ${totalBooks} (keyword: ${keywordTotal}, semantic: ${semanticTotal})`);
    // 6. Clean internal fields
    const cleanBooks = combinedBooks.map(({ 
      _semanticScore, 
      _semanticRank, 
      ...book 
    }) => book);

    // 7. RESPONSE
    res.json({
      success: true,
      data: cleanBooks,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalBooks: totalBooks,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum
      },
      searchType: semanticBooks.length > 0 ? 'hybrid' : 'keyword',
      stats: {
        keywordResults: keywordItems.length,
        semanticResults: semanticBooks.length,
        combinedResults: cleanBooks.length,
        keywordTotal: keywordTotal,
        semanticTotal: semanticTotal,
        estimatedTotal: totalBooks,
        page: pageNum
      }
    });

  } catch (error) {
    console.error('❌ Hybrid search error:', error.message);
    
    // Fallback to simple keyword search
    try {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 24;
      const skipCount = (pageNum - 1) * limitNum;

      const books = await Book.find({
        $or: [
          { title: { $regex: query || '', $options: 'i' } },
          { author: { $regex: query || '', $options: 'i' } }
        ]
      })
      .skip(skipCount)
      .limit(limitNum)
      .select('title author coverImageUrl gutenbergId downloadCount subjects summary')
      .lean();

      const total = await Book.countDocuments({
        $or: [
          { title: { $regex: query || '', $options: 'i' } },
          { author: { $regex: query || '', $options: 'i' } }
        ]
      });

      res.json({
        success: true,
        data: books,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalBooks: total,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1,
          limit: limitNum
        },
        searchType: 'fallback',
        message: 'Using fallback search'
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        message: 'Search service unavailable',
        error: error.message
      });
    }
  }
};

// SIMPLE KEYWORD SEARCH
const simpleSearch = async (req, res) => {
  try {
    const { query, limit = 24, page = 1 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(parseInt(limit), 100));
    const skipCount = (pageNum - 1) * limitNum;

    console.log(`🔍 Simple search for: "${query}" - Page ${pageNum}`);

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const books = await Book.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
        { subjects: { $regex: query, $options: 'i' } },
        { summary: { $regex: query, $options: 'i' } }
      ]
    })
    .skip(skipCount)
    .limit(limitNum)
    .select('title author coverImageUrl gutenbergId downloadCount subjects summary')
    .lean();

    const total = await Book.countDocuments({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
        { subjects: { $regex: query, $options: 'i' } },
        { summary: { $regex: query, $options: 'i' } }
      ]
    });

    console.log(`✅ Page ${pageNum}: ${books.length} books (total: ${total})`);

    res.json({
      success: true,
      data: books,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalBooks: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
        limit: limitNum
      },
      searchType: 'keyword'
    });

  } catch (error) {
    console.error('❌ Simple search error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// QUICK SEARCH (autocomplete)
const quickSearch = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    console.log(`⚡ Quick search for: "${q}"`);

    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: [],
        query: q
      });
    }

    const books = await Book.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } }
      ]
    })
    .limit(parseInt(limit))
    .select('title author gutenbergId')
    .sort({ downloadCount: -1 })
    .lean();

    console.log(`✅ Quick search found ${books.length} suggestions`);

    res.json({
      success: true,
      data: books,
      query: q,
      count: books.length
    });

  } catch (error) {
    console.error('❌ Quick search error:', error.message);
    res.json({
      success: false,
      data: [],
      error: error.message
    });
  }
};

const clearSemanticCache = async (req, res) => {
  const size = semanticCache.size;
  semanticCache.clear();
  console.log(`🗑️ Cleared semantic cache (${size} entries)`);
  res.json({ 
    success: true, 
    cleared: size,
    message: 'Semantic search cache cleared' 
  });
};
module.exports = {
  hybridSearch,
  simpleSearch,
  quickSearch,
  clearSemanticCache
};