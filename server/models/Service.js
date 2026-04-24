const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subtitle: String,
  description: String,
  price: String,
  duration: String,
  image: String,
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
});

serviceSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Service', serviceSchema);
