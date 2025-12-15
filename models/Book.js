// backend/models/Book.js
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    gutenbergId: { type: Number, unique: true, sparse: true },
    title: { type: String, required: true },
    isbn: { type: String, unique: true, sparse: true }, 
    author: { type: String, required: true },
    subjects: { type: [String] }, 
    summary: { type: String },
      generated_blurb: { type: String },
    downloadCount: { type: Number },
    issuedDate: { type: Date },
    readingEaseScore: { type: Number },
    coverImageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  ratingDistribution: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 }
  }
},{ 
    collection: 'books',
    timestamps: true 
}


);


bookSchema.index({ gutenbergId: 1 });
bookSchema.index({ downloadCount: -1 });
bookSchema.index({ author: 1 });

const Book = mongoose.model('Book', bookSchema);
module.exports = Book;