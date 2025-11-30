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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Alternative: Allow all origins (for development only)
// app.use(cors());

app.use(express.json());

// Routes
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Tome Library API is running',
    timestamp: new Date().toISOString()
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

// Database connection
const connectDB = require('./config/mongooseConfig');
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Tome Library Backend running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: http://localhost:5173`);
});