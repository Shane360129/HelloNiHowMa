const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const MessageTemplate = sequelize.define(
  'MessageTemplate',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, defaultValue: '' },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    channel: {
      type: DataTypes.ENUM('line_text', 'line_flex'),
      defaultValue: 'line_text',
      allowNull: false
    },
    content: { type: DataTypes.TEXT, allowNull: false },
    flexJson: { type: DataTypes.JSONB, allowNull: true },
    variables: { type: DataTypes.JSONB, defaultValue: [] },
    updatedBy: { type: DataTypes.STRING, defaultValue: '' }
  },
  {
    tableName: 'message_templates',
    timestamps: true
  }
);

module.exports = MessageTemplate;
