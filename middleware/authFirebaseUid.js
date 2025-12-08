// backend/middleware/authFirebaseUid.js
const authFirebaseUid = (req, res, next) => {
  console.log('🔍 authFirebaseUid middleware called for because-you-liked');
  
  // Check multiple header locations
  const firebaseUid = req.headers.firebaseuid || 
                      req.headers['firebase-uid'] ||
                      req.headers['x-firebase-uid'] ||
                      req.query.firebaseuid; // Also check query params
  
  console.log('Headers:', {
    firebaseuid: req.headers.firebaseuid,
    'firebase-uid': req.headers['firebase-uid'],
    'x-firebase-uid': req.headers['x-firebase-uid']
  });
  
  if (!firebaseUid) {
    console.log('⚠️ No firebaseUid found - allowing with demo user');
    req.firebaseUid = 'demo-user';
    req.isDemoUser = true;
    return next();
  }
  
  req.firebaseUid = firebaseUid;
  req.isDemoUser = false;
  console.log(`✅ Firebase UID set: ${firebaseUid}`);
  next();
};

module.exports = { authFirebaseUid };