const express = require('express');
const cors = require('cors');
const connectDB = require('./config/mongooseConfig');
const allRoutes = require('./routes');
const mongoose = require('mongoose');
const bookRoutes = require('./routes/bookRoutes');

const app = express();
// Railway automatically sets the PORT environment variable
const port = process.env.PORT || 3000;

// --- MONGODB CONNECTION ---
connectDB();

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
app.use(allRoutes);

// 1. Health Check (Always public)
app.get('/', (req, res) => {
  res.send(`Backend is running. MongoDB connection state: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});


// --- SERVER START ---
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
