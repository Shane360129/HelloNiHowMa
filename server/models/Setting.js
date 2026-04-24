const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  lineChannelAccessToken: { type: String, default: '' },
  lineTargetId: { type: String, default: '' },
  lineNotifyToken: { type: String, default: '' },
  businessName: { type: String, default: 'La Paisley' },
  businessHours: { type: String, default: '週二 - 週日 11:00 - 20:00（週一公休）' },
  bookingNote: { type: String, default: '預約送出後，我們會透過 LINE 或電話確認實際時段' },
  bookingEnabled: { type: Boolean, default: true }
});

settingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Setting', settingSchema);
