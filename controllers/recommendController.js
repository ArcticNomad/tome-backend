// backend/controllers/recommendController.js
const { getUserByFirebaseUid } = require("../services/userService");
const { recommendBooks } = require("../services/recommendService");

/**
 * GET /api/recommend
 * Returns book recommendations based on user's favorite genres
 */
const getRecommendations = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;

    // Fetch user from MongoDB
    const user = await getUserByFirebaseUid(firebaseUid);
    if (!user) return res.status(404).json({ message: "User not found" });

    const favoriteGenres = user.readingPreferences.favoriteGenres || [];

    // Get recommendations from recommendService
    const { topBookIds, books } = await recommendBooks(favoriteGenres);

    return res.json({
      firebaseUid,
      favoriteGenres,
      recommendedBooks: books
    });
  } catch (err) {
    console.error("Recommendation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getRecommendations };
