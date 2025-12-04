const { pipeline } = require("@xenova/transformers");

let embedder = null;

const generateEmbedding = async (text) => {
  if (!embedder) {
    console.log("📥 Loading Xenova embedding model...");
    embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2");
  }

  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
};

module.exports = { generateEmbedding };
