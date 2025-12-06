// backend/config/qdrantConfig.js
require('dotenv').config();

const { QdrantClient } = require("@qdrant/js-client-rest");

const CONFIG = {
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY,
  qdrantCollection: process.env.QDRANT_COLLECTION || "books_metadata",
  modelName: process.env.MODEL_NAME || "Xenova/all-mpnet-base-v2",
  embeddingDim: Number(process.env.EMBEDDING_DIM) || 768
};

console.log('🔧 Qdrant Configuration:');
console.log(`   URL: ${CONFIG.qdrantUrl}`);
console.log(`   Collection: ${CONFIG.qdrantCollection}`);
console.log(`   API Key: ${CONFIG.qdrantApiKey ? 'Set' : 'Not set'}`);

const qdrant = new QdrantClient({
  url: CONFIG.qdrantUrl,
  ...(CONFIG.qdrantApiKey && { apiKey: CONFIG.qdrantApiKey }),
});

// Test connection function
async function testQdrantConnection() {
  try {
    console.log('🔌 Testing Qdrant connection...');
    const collections = await qdrant.getCollections();
    console.log(`✅ Qdrant connected. Available collections: ${collections.collections.length}`);
    
    // Check if our collection exists
    const collectionExists = collections.collections.some(
      coll => coll.name === CONFIG.qdrantCollection
    );
    
    if (!collectionExists) {
      console.warn(`⚠️ Collection "${CONFIG.qdrantCollection}" not found in Qdrant`);
      console.warn('💡 You need to create the collection and upload book embeddings');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Qdrant connection failed:', error.message);
    console.log('💡 To start Qdrant locally:');
    console.log('   1. Install Docker');
    console.log('   2. Run: docker run -p 6333:6333 qdrant/qdrant');
    console.log('   3. Wait for Qdrant to start, then restart your backend');
    return false;
  }
}

module.exports = { 
  qdrant, 
  CONFIG, 
  testQdrantConnection 
};