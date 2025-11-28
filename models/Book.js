// models/Book.js
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    gutenbergId: { type: Number, unique: true, sparse: true },
    title: { type: String, required: true },
    isbn: { type: String, unique: true, sparse: true }, 
    author: { type: String, required: true },
    subjects: { type: [String] }, 
    summary: { type: String },
    downloadCount: { type: Number },
    issuedDate: { type: Date },
    readingEaseScore: { type: Number },
    coverImageUrl: { type: String },
    isAvailable: { type: Boolean, default: true }
}, { 
    collection: 'books',
    timestamps: true 
});

// Add index for better performance
bookSchema.index({ gutenbergId: 1 });
bookSchema.index({ downloadCount: -1 });
bookSchema.index({ author: 1 });

const Book = mongoose.model('Book', bookSchema);
module.exports = Book;