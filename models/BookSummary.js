  const mongoose = require("mongoose");

const bookSummarySchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  
}, {
  collection: "books" 
});

module.exports = mongoose.model("BookSummary", bookSummarySchema);