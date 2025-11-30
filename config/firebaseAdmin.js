// backend/config/firebaseAdmin.js
const admin = require('firebase-admin');

const serviceAccount = require('../tome-bca58-firebase-adminsdk-fbsvc-f2a5b2a284.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;