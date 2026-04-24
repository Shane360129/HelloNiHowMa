const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Profile = sequelize.define(
  'Profile',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, defaultValue: '' },
    title: { type: DataTypes.STRING, defaultValue: '' },
    tagline: { type: DataTypes.STRING, defaultValue: '' },
    bio: { type: DataTypes.TEXT, defaultValue: '' },
    homeIntro: { type: DataTypes.TEXT, defaultValue: '' },
    avatar: { type: DataTypes.TEXT, defaultValue: '' },
    heroImage: { type: DataTypes.TEXT, defaultValue: '' },
    email: { type: DataTypes.STRING, defaultValue: '' },
    phone: { type: DataTypes.STRING, defaultValue: '' },
    location: { type: DataTypes.STRING, defaultValue: '' },
    address: { type: DataTypes.STRING, defaultValue: '' },
    social: { type: DataTypes.JSONB, defaultValue: {} }
  },
  { tableName: 'profiles', timestamps: false }
);

module.exports = Profile;
