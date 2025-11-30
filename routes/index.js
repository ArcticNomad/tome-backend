const express = require('express');
const router = express.Router();

const bookRoutes = require('./bookRoutes');
// const authRoutes = require('./authRoutes');


router.use('/api', bookRoutes);
// router.use('/api', authRoutes);
// router.use('/api', userRoutes);

module.exports = router;
