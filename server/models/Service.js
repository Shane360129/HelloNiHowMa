const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Service = sequelize.define(
  'Service',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    subtitle: { type: DataTypes.STRING, defaultValue: '' },
    description: { type: DataTypes.TEXT, defaultValue: '' },
    price: { type: DataTypes.STRING, defaultValue: '' },
    duration: { type: DataTypes.STRING, defaultValue: '' },
    durationMinutes: { type: DataTypes.INTEGER, defaultValue: 180 },
    image: { type: DataTypes.TEXT, defaultValue: '' },
    featured: { type: DataTypes.BOOLEAN, defaultValue: false },
    order: { type: DataTypes.INTEGER, defaultValue: 0 }
  },
  { tableName: 'services', timestamps: false }
);

module.exports = Service;
