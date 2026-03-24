const mongoose = require('mongoose');

const workSchema = new mongoose.Schema({
  title: String,
  description: String,
  image: String,
  category: String,
  notes: {
    top: String,
    middle: String,
    base: String
  },
  featured: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

workSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Work', workSchema);
