const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  name: String,
  title: String,
  tagline: String,
  bio: String,
  avatar: String,
  heroImage: String,
  email: String,
  phone: String,
  location: String,
  address: String,
  social: {
    instagram: String,
    facebook: String,
    line: String,
    threads: String
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
