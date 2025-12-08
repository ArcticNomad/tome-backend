// backend/services/embeddingService.js
let embedder = null;

const initializeEmbedder = async () => {
  if (!embedder) {
    try {
      console.log("📥 Loading Xenova embedding model...");
      const { pipeline } = await import("@xenova/transformers");
      embedder = await pipeline("feature-extraction", "Xenova/all-mpnet-base-v2");
      console.log("✅ Embedding model loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load embedding model:", error);
      throw error;
    }
  }
  return embedder;
};

const generateEmbedding = async (text) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Invalid text for embedding');
    }
    
    const model = await initializeEmbedder();
    console.log(`🔤 Generating embedding for text: "${text.substring(0, 100)}..."`);
    
    const output = await model(text, { 
      pooling: "mean", 
      normalize: true 
    });
    
    const embedding = Array.from(output.data);
    console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
    
    return embedding;
  } catch (error) {
    console.error("❌ Embedding generation error:", error);
    throw error;
  }
};

module.exports = { generateEmbedding };