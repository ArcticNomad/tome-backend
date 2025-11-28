const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Define user schema here
});

const User = mongoose.model('User', userSchema);

module.exports = User;
