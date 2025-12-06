  // backend/server.js
  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  require('dotenv').config();

  const app = express();

  // CORS Configuration - FIXED
  app.use(cors({
    origin: [
      'http://localhost:5173', // Vite default
      'http://localhost:3000', // Create React App default
      'http://127.0.0.1:5173',
      'https://your-vercel-app.vercel.app' // Your production frontend
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'firebaseuid',  // ADD THIS LINE - lowercase
      'firebaseUid',  // ADD THIS LINE - camelCase (for consistency)
      'X-Firebase-Uid' // ADD THIS LINE - with dash
    ]
  }));

  // Alternative: Allow all origins (for development only)
  // app.use(cors());

  app.use(express.json());

  // Routes
  app.use('/api/books', require('./routes/bookRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/reviews',require('./routes/reviewRoutes'))
  const searchRoutes = require('./routes/search');
  app.use('/api/search', searchRoutes);



  

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Tome Library API is running',
      timestamp: new Date().toISOString()
    });
  });
  app.get('/api/test', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Backend is working!',
      availableEndpoints: [
        'GET /api/health',
        'GET /api/test-cors',
        'GET /api/test',
        'POST /api/users/create-profile',
        'GET /api/users/profile',
        'PUT /api/users/profile'
      ]
    });
  });

  // Test route to verify CORS
  app.get('/api/test-cors', (req, res) => {
    res.json({ 
      success: true, 
      message: 'CORS is working!',
      origin: req.headers.origin 
    });
  });

  // Add this debug route to your server.js file:
  app.get('/api/debug-all-routes', (req, res) => {
    const routes = [];
    
    // Loop through all registered routes
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        // Routes registered directly on the app
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === 'router') {
        // Routes mounted with app.use()
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            routes.push({
              path: middleware.regexp.toString() + handler.route.path,
              methods: Object.keys(handler.route.methods)
            });
          }
        });
      }
    });
    
    res.json({ routes });
  });


  // Add this to server.js temporarily
  app.get('/api/debug-embeddings', async (req, res) => {
    try {
      const { recommendBooks } = require('./services/recommendService');
      
      // Test with different genre combinations
      const testGenres = [
        ['Fantasy', 'Magic'],
        ['Science Fiction', 'Space'],
        ['Mystery', 'Detective'],
        ['Romance', 'Love']
      ];
      
      const results = {};
      
      for (const genres of testGenres) {
        const { books } = await recommendBooks(genres);
        results[genres.join(', ')] = {
          count: books.length,
          books: books.slice(0, 3).map(b => b.title)
        };
      }
      
      res.json({
        success: true,
        message: 'Embeddings test',
        results
      });
      
    } catch (error) {
      res.json({
        success: false,
        error: error.message
      });
    }
  });


// Add this to server.js temporarily to see Qdrant contents
app.get('/api/debug-qdrant-payloads', async (req, res) => {
  try {
    const { qdrant } = require('./config/qdrantConfig');
    
    console.log('🔍 Debugging Qdrant payloads...');
    
    // Get some sample points
    const samplePoints = await qdrant.scroll("books_metadata", {
      limit: 5,
      with_payload: true,
      with_vector: false
    });
    
    const payloadAnalysis = samplePoints.points.map((point, index) => {
      const payload = point.payload || {};
      return {
        pointId: point.id,
        payloadKeys: Object.keys(payload),
        payloadPreview: Object.entries(payload).map(([key, value]) => ({
          key,
          type: typeof value,
          value: typeof value === 'string' ? 
            (value.length > 50 ? value.substring(0, 50) + '...' : value) : 
            value
        })).slice(0, 10) // Show first 10 fields
      };
    });
    
    // Also check what fields might contain book-like data
    const allFields = new Set();
    samplePoints.points.forEach(point => {
      Object.keys(point.payload || {}).forEach(key => allFields.add(key));
    });
    
    res.json({
      success: true,
      totalPoints: samplePoints.points.length,
      allFields: Array.from(allFields),
      payloadSamples: payloadAnalysis,
      suggestion: 'Look for fields that might contain book identifiers (like numbers or titles)'
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



  // Database connection
  const connectDB = require('./config/mongooseConfig');
  connectDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Tome Library Backend running on port ${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS enabled for: http://localhost:5173`);
  });