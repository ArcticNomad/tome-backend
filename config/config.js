require('dotenv').config();

const CONFIG = {
  qdrantUrl: process.env.QDRANT_URL,
  qdrantApiKey: process.env.QDRANT_API_KEY,
  qdrantCollection: process.env.QDRANT_COLLECTION,
  modelName: process.env.MODEL_NAME,
  embeddingDim: Number(process.env.EMBEDDING_DIM)
};

module.exports = { CONFIG };
