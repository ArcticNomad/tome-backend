// backend/services/embeddingService.js

let embedder = null;
let pipeline = null;

const generateEmbedding = async (text) => {
  try {
    if (!embedder) {
      console.log("📥 Loading Xenova embedding model...");
      
      // Use dynamic import for ES module
      const transformers = await import("@xenova/transformers");
      pipeline = transformers.pipeline;
      
      embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2");
      console.log("✅ Embedding model loaded successfully");
    }

    console.log(`🔤 Generating embedding for text: ${text.substring(0, 50)}...`);
    const output = await embedder(text, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data);
    console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
    
    return embedding;
  } catch (error) {
    console.error("❌ Embedding generation error:", error);
    throw error;
  }
};

module.exports = { generateEmbedding };