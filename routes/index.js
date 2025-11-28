const express = require('express');
const router = express.Router();

const bookRoutes = require('./bookRoutes');
// const authRoutes = require('./authRoutes');
// const userRoutes = require('./userRoutes');

router.use('/api', bookRoutes);
// router.use('/api', authRoutes);
// router.use('/api', userRoutes);

module.exports = router;
