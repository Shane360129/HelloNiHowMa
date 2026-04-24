const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const News = sequelize.define(
  'News',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, defaultValue: '' },
    image: { type: DataTypes.TEXT, defaultValue: '' },
    link: { type: DataTypes.STRING, defaultValue: '' },
    pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
    published: { type: DataTypes.BOOLEAN, defaultValue: true },
    publishedAt: {
      type: DataTypes.STRING,
      defaultValue: () => new Date().toISOString().slice(0, 10)
    }
  },
  {
    tableName: 'news',
    timestamps: true
  }
);

module.exports = News;
