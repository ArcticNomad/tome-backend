// server.js (Backend)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bookRoutes = require('./routes/bookRoutes');

const app = express();
const port = process.env.PORT || 5000;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// Enhanced CORS configuration
app.use(cors({
    origin: [
        'http://localhost:5173', // Vite default port
        'http://localhost:3000', // Create React App default
        'https://tome-frontend-arc.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Routes
app.use('/api/books', bookRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 Frontend should connect from: http://localhost:5173`);
});