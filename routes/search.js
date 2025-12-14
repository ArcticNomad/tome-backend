// backend/routes/search.js - CORRECTED
const express = require('express');
const { 
  hybridSearch,
  simpleSearch,
  quickSearch,
  clearSemanticCache  // Updated to match export
} = require('../controllers/searchController');

const router = express.Router();

// Main hybrid search endpoint (default)
router.get('/', hybridSearch);
router.get('/hybrid', hybridSearch);

// Simple keyword-only search
router.get('/simple', simpleSearch);

// Quick search for autocomplete/suggestions
router.get('/quick', quickSearch);


router.delete('/cache', clearSemanticCache); 


router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Search API is working',
    endpoints: {
      hybrid: 'GET /api/search/hybrid?query=text&page=1&limit=24',
      simple: 'GET /api/search/simple?query=text&page=1&limit=24',
      quick: 'GET /api/search/quick?q=text&limit=10',
      cache: 'DELETE /api/search/cache'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;