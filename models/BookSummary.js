const mongoose = require("mongoose");

const bookSummarySchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  
}, {
  collection: "books" // Use the same collection as your full Book model
});

module.exports = mongoose.model("BookSummary", bookSummarySchema);
