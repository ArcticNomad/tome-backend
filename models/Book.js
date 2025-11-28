const mongoose = require('mongoose');

// Schema simplified to include only the fields needed for display/search
const bookSchema = new mongoose.Schema({
    // ESSENTIAL: Identification and Title
    gutenbergId: { type: Number, unique: true, sparse: true },
    title: { type: String, required: true },
    isbn: { type: String, unique: true, sparse: true }, 
    
    // METADATA: Core attributes
    author: { type: String, required: true },
    subjects: { type: [String] }, 
    summary: { type: String },
    
    // METRICS & FILES: Download info and media
    downloadCount: { type: Number },
    issuedDate: { type: Date },
    readingEaseScore: { type: Number },
    coverImageUrl: { type: String },
    isAvailable: { type: Boolean }
}, { collection: 'books' }); // Explicitly set collection name

const Book = mongoose.model('Book', bookSchema);
module.exports = Book;