// routes/books.js
const express = require('express');
const router = express.Router();
const Book = require('../models/Book');

/**
 * GET /api/books
 * Retrieves books with pagination and filtering
 */
router.get('/', async (req, res) => {
    try {
        const { 
            limit = 50, 
            page = 1, 
            sortBy = 'downloadCount', 
            sortOrder = 'desc',
            search 
        } = req.query;

        // Build query
        let query = {};
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { author: { $regex: search, $options: 'i' } },
                { subjects: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const books = await Book.find(query)
            .sort(sort)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Book.countDocuments(query);

        res.json({
            books,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ 
            message: 'Error retrieving books from database.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/books/search
 * Search books by title, author, or subjects
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const books = await Book.find({
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { author: { $regex: q, $options: 'i' } },
                { subjects: { $in: [new RegExp(q, 'i')] } },
                { summary: { $regex: q, $options: 'i' } }
            ]
        }).limit(20);

        res.json(books);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});

/**
 * GET /api/books/:id
 * Get single book by Gutenberg ID
 */
router.get('/:id', async (req, res) => {
    try {
        const book = await Book.findOne({ gutenbergId: req.params.id });
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        res.json(book );
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ message: 'Error fetching book' });
    }
});

module.exports = router;