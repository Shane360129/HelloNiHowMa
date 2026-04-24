const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Setting = sequelize.define(
  'Setting',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    lineChannelAccessToken: { type: DataTypes.TEXT, defaultValue: '' },
    lineTargetId: { type: DataTypes.STRING, defaultValue: '' },
    lineNotifyToken: { type: DataTypes.TEXT, defaultValue: '' },
    businessName: { type: DataTypes.STRING, defaultValue: 'La Paisley' },
    businessHours: {
      type: DataTypes.STRING,
      defaultValue: '週二 - 週日 11:00 - 20:00（週一公休）'
    },
    bookingNote: {
      type: DataTypes.STRING,
      defaultValue: '預約送出後，我們會透過 LINE 或電話確認實際時段'
    },
    bookingEnabled: { type: DataTypes.BOOLEAN, defaultValue: true }
  },
  { tableName: 'settings', timestamps: false }
);

module.exports = Setting;
