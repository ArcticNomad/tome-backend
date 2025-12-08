// backend/middleware/authMiddleware.js
const admin = require('../config/firebaseAdmin');

const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    req.firebaseUid = null;
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUid = decoded.uid;
    req.user = decoded;
    console.log(`Authenticated: ${decoded.email || decoded.uid}`);
  } catch (err) {
    console.log("Invalid token → continuing as guest");
    req.firebaseUid = null;
  }

  next();
};

module.exports = { verifyFirebaseToken };