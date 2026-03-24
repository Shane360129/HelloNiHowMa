const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  name: String,
  title: String,
  bio: String,
  avatar: String,
  email: String,
  phone: String,
  location: String,
  social: {
    instagram: String,
    facebook: String,
    line: String
  }
});

profileSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Profile', profileSchema);
