const mongoose = require("mongoose");

const appUserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    displayName: { type: String },
    email: { type: String },
    readingPreferences: {
      favoriteGenres: { type: [String], default: [] }
    }
  },
  { collection: "users", timestamps: true }
);

module.exports = mongoose.model("AppUser", appUserSchema);
