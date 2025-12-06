const authFirebaseUid = (req, res, next) => {
  const firebaseUid = req.headers.firebaseuid;

  if (!firebaseUid) {
    return res.status(400).json({ message: "firebaseUid header missing" });
  }

  req.firebaseUid = firebaseUid;
  next();
};

const AppUser = require("../models/AppUser");

const getUserByFirebaseUid = async (firebaseUid) => {
  return await AppUser.findOne({ firebaseUid });
};

module.exports = { authFirebaseUid, getUserByFirebaseUid};
