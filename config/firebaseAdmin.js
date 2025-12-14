// backend/config/firebaseAdmin.js
const admin = require('firebase-admin');


if (!admin.apps.length) {
  try {

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error('❌ Missing Firebase environment variables');
      console.error('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
      console.error('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
      console.error('FIREBASE_PRIVATE_KEY length:', process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length + ' chars' : 'Missing');
      
    
      console.log('⚠️ Firebase Admin not initialized - auth will be disabled');
      module.exports = null;
      return;
    }

  
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
  
    privateKey = privateKey.replace(/\\n/g, '\n');
    
 
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    
    console.log('✅ Firebase Admin initialized successfully');
    module.exports = admin;
    
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.error('Stack:', error.stack);
    module.exports = null;
  }
} else {
  module.exports = admin;
}