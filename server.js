const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const frontendURL = process.env.FRONTEND_URL;
if (frontendURL) {
  app.use(cors({ origin: frontendURL }));
}

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Book Schema and Model
const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  googleBooksId: { type: String, unique: true }
});
const Book = mongoose.model('Book', bookSchema);

// API Routes
app.get('/', (req, res) => {
  res.send(`Backend is running. MongoDB connection state: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});

app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching books', error });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
