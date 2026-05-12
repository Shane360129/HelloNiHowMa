const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Booking = sequelize.define(
  'Booking',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // 客戶資訊（snapshot：保留下單當下值，userId 變更不影響）
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    lineId: { type: DataTypes.STRING, defaultValue: '' },

    // D8：所有預約都連結 User（包含走入/電話客戶）
    userId: { type: DataTypes.INTEGER, allowNull: true },

    // 預約內容
    service: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    time: { type: DataTypes.STRING, allowNull: false },
    durationMinutes: { type: DataTypes.INTEGER, defaultValue: 210 },
    notes: { type: DataTypes.TEXT, defaultValue: '' },
    internalNotes: { type: DataTypes.TEXT, defaultValue: '' },

    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },

    // 預約來源
    source: {
      type: DataTypes.ENUM('customer_self', 'admin_phone', 'admin_dm', 'walk_in'),
      defaultValue: 'customer_self',
      allowNull: false
    },

    // 後台代客建立時記錄管理員
    createdByAdminId: { type: DataTypes.INTEGER, allowNull: true },

    // 已寄出提醒的時間（cron 用，避免重發）
    reminderSentAt: { type: DataTypes.DATE, allowNull: true }
  },
  {
    tableName: 'bookings',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['userId'] },
      { fields: ['date', 'status'] },
      { fields: ['source'] },
      { fields: ['phone'] }
    ]
  }
);

module.exports = Booking;
