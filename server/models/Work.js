const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Work = sequelize.define(
  'Work',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, defaultValue: '' },
    description: { type: DataTypes.TEXT, defaultValue: '' },
    image: { type: DataTypes.TEXT, defaultValue: '' },
    beforeImage: { type: DataTypes.TEXT, defaultValue: '' },
    category: { type: DataTypes.STRING, defaultValue: '' },
    featured: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdAt: {
      type: DataTypes.STRING,
      defaultValue: () => new Date().toISOString().split('T')[0]
    }
  },
  { tableName: 'works', timestamps: false }
);

module.exports = Work;
