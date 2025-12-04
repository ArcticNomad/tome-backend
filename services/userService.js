const AppUser = require("../models/AppUser");

const getUserByFirebaseUid = async (firebaseUid) => {
  return await AppUser.findOne({ firebaseUid });
};

module.exports = { getUserByFirebaseUid };
