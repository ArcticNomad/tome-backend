// backend/services/recommendService.js
const { qdrant } = require("../config/qdrantConfig");
const Book = require('../models/Book');

let embedder = null;
const initializeEmbedder = async () => {
  if (!embedder) {
    console.log("Loading Xenova model...");
    const { pipeline } = await import("@xenova/transformers");
    embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2");
    console.log("Model loaded");
  }
  return embedder;
};

const generateEmbedding = async (text) => {
  const model = await initializeEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
};

const recommendBooks = async (terms = [], limit = 20) => {
  if (!terms || terms.length === 0) {
    console.log("No terms → fallback");
    const popular = await Book.find().sort({ downloadCount: -1 }).limit(limit);
    return { books: popular };
  }

  const queryText = terms.join(" ");
  console.log("Generating embedding for:", queryText);

  try {
    const vector = await generateEmbedding(queryText);

    const results = await qdrant.search("books_metadata", {
      vector,
      limit: 80,
      with_payload: true,
      score_threshold: 0.18
    });

    const ids = results
      .map(r => r.payload?.gutenbergId || r.payload?.book_id)
      .filter(Boolean);

    let books = await Book.find({ gutenbergId: { $in: ids } })
      .select('title author coverImageUrl gutenbergId subjects downloadCount generated_blurb')
      .limit(limit * 2);

    // Dedupe + shuffle slightly for freshness
    const seen = new Set();
    const unique = [];
    for (const book of books) {
      if (!seen.has(book.gutenbergId)) {
        seen.add(book.gutenbergId);
        unique.push(book);
      }
    }

    return { books: unique.slice(0, limit) };

  } catch (err) {
    console.error("Embedding search failed:", err.message);
    const fallback = await Book.find().sort({ downloadCount: -1 }).limit(limit);
    return { books: fallback };
  }
};

module.exports = { recommendBooks };