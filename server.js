const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// const admin = require('firebase-admin'); // <-- COMMENTED OUT: Deferring Firebase setup

const app = express();
// Railway automatically sets the PORT environment variable
const port = process.env.PORT || 3000;

// --- MONGODB CONNECTION ---
const mongoURI = process.env.MONGO_URI;
// Removed old deprecated options (useNewUrlParser, useUnifiedTopology) for modern Mongoose versions
if (!mongoURI) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set.");
} else {
    mongoose.connect(mongoURI)
        .then(() => console.log('✅ MongoDB connected'))
        .catch(err => console.error('❌ MongoDB connection error:', err.message));
}

// --- BOOK SCHEMA AND MODEL ---
// Updated to match the fields of your test data
const bookSchema = new new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String }, // Added
    isbn: { type: String, unique: true },
    embeddingId: { type: String }, // Added for Qdrant linking later
    genre: { type: String }, // Added
    pages: { type: Number } // Added
});
const Book = mongoose.model('Book', bookSchema);


// --- MIDDLEWARE ---
// CORS configuration
const frontendURL = process.env.FRONTEND_URL; // Should be your Vercel URL
const corsOptions = {
    origin: frontendURL || '*', // Allow Vercel frontend or any origin if testing locally
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json()); // Allows parsing JSON bodies

// --- API ROUTES ---

// 1. Health Check (Always public)
app.get('/', (req, res) => {
  res.send(`Backend is running. MongoDB connection state: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});

// 2. FETCH ALL BOOKS ROUTE (Currently Public)
// This route now fetches the complete metadata from MongoDB Atlas.
app.get('/api/books', async (req, res) => {
  try {
    // Check if MongoDB is actually connected before querying
    if (mongoose.connection.readyState !== 1) {
         return res.status(500).json({ message: 'Database connection failed. Please check MONGO_URI.' });
    }
    
    // Fetch all books (you may want to limit this later for performance)
    const books = await Book.find().limit(20); 
    res.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ message: 'Error fetching books from database', error: error.message });
  }
});

// --- SERVER START ---
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});