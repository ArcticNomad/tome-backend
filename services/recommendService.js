const { qdrant } = require("../config/qdrant");
const BookSummary = require("../models/BookSummary");
const { generateEmbedding } = require("./embedService");


const recommendBooks = async (favoriteGenres) => {
  if (!favoriteGenres || favoriteGenres.length === 0) return [];

  const combinedText = favoriteGenres.join(" ");
  const queryVector = await generateEmbedding(combinedText);

  const searchResults = await qdrant.search("books_metadata", {
    vector: queryVector,
    limit: 50,
    with_payload: true
  });

  const topBookIds = searchResults
    .map(r => r.payload.book_id)
    .filter(id => id !== undefined && id !== null);

  // Fetch only the summary fields using the new model
  const books = await BookSummary.find(
  { _id: { $in: topBookIds } },
  { _id: 1, title: 1, author: 1, subjects: 1 } // only these fields
);

  return {books };
};

module.exports = { recommendBooks };
