const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Booking = sequelize.define(
  'Booking',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    lineId: { type: DataTypes.STRING, defaultValue: '' },
    service: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    time: { type: DataTypes.STRING, allowNull: false },
    durationMinutes: { type: DataTypes.INTEGER, defaultValue: 210 },
    notes: { type: DataTypes.TEXT, defaultValue: '' },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
      defaultValue: 'pending'
    }
  },
  {
    tableName: 'bookings',
    timestamps: true,
    updatedAt: false
  }
);

module.exports = Booking;
