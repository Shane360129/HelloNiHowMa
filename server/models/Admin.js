const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Admin = sequelize.define(
  'Admin',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
  },
  { tableName: 'admins', timestamps: false }
);

module.exports = Admin;
