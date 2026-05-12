const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Setting = sequelize.define(
  'Setting',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // LINE Messaging API（店家通知）
    lineChannelAccessToken: { type: DataTypes.TEXT, defaultValue: '' },
    lineChannelSecret: { type: DataTypes.TEXT, defaultValue: '' },
    lineTargetId: { type: DataTypes.STRING, defaultValue: '' },

    // LINE Login（客戶登入）
    lineLoginChannelId: { type: DataTypes.STRING, defaultValue: '' },
    lineLoginChannelSecret: { type: DataTypes.TEXT, defaultValue: '' },
    lineLiffId: { type: DataTypes.STRING, defaultValue: '' },

    // 店家在 LINE 內可一鍵確認預約的 userId 白名單 (D4)
    adminLineUserIds: { type: DataTypes.JSONB, defaultValue: [] },

    // 店家資訊
    businessName: { type: DataTypes.STRING, defaultValue: 'La Paisley' },
    businessHours: {
      type: DataTypes.STRING,
      defaultValue: '週二 - 週日 11:00 - 20:00（週一公休）'
    },
    bookingNote: {
      type: DataTypes.STRING,
      defaultValue: '預約送出後，我們會透過 LINE 或電話確認實際時段'
    },
    bookingEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },

    // 預約時段
    weeklySchedule: {
      type: DataTypes.TEXT,
      defaultValue: JSON.stringify({
        0: [{ start: '09:30', end: '20:00' }],
        1: [{ start: '09:30', end: '13:00' }],
        2: [{ start: '09:30', end: '13:00' }],
        3: [{ start: '09:30', end: '13:00' }],
        4: [{ start: '09:30', end: '13:00' }],
        5: [{ start: '09:30', end: '13:00' }],
        6: [{ start: '09:30', end: '20:00' }]
      })
    },
    dateOverrides: { type: DataTypes.TEXT, defaultValue: '{}' },
    defaultBookingDuration: { type: DataTypes.INTEGER, defaultValue: 210 },
    slotInterval: { type: DataTypes.INTEGER, defaultValue: 30 },

    // 預約規則 (D7)
    bookingBufferMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
    bookingEarliestDays: { type: DataTypes.INTEGER, defaultValue: 1 },
    bookingLatestHours: { type: DataTypes.INTEGER, defaultValue: 24 },
    bookingCancelHoursLimit: { type: DataTypes.INTEGER, defaultValue: 24 },
    bookingPerUserPerWeek: { type: DataTypes.INTEGER, defaultValue: 0 },
    lineLoginRequired: { type: DataTypes.BOOLEAN, defaultValue: true }, // D1

    // 提醒 (D3)
    reminderEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    reminderTime: { type: DataTypes.STRING, defaultValue: '10:00' },
    reminderLeadDays: { type: DataTypes.INTEGER, defaultValue: 1 },

    // 推播配額警告
    pushQuotaWarnThreshold: { type: DataTypes.INTEGER, defaultValue: 50 },

    // GA4 (D10)
    googleAnalyticsId: { type: DataTypes.STRING, defaultValue: '' }
  },
  { tableName: 'settings', timestamps: false }
);

module.exports = Setting;
