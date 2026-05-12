const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Broadcast = sequelize.define(
  'Broadcast',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    type: {
      type: DataTypes.ENUM('single', 'tag', 'all_followers'),
      allowNull: false
    },
    recipientUserIds: { type: DataTypes.JSONB, defaultValue: [] },
    recipientTags: { type: DataTypes.JSONB, defaultValue: [] },
    messageType: {
      type: DataTypes.ENUM('text', 'flex', 'image'),
      defaultValue: 'text',
      allowNull: false
    },
    content: { type: DataTypes.TEXT, defaultValue: '' },
    flexJson: { type: DataTypes.JSONB, allowNull: true },
    imageUrl: { type: DataTypes.STRING, defaultValue: '' },
    scheduledAt: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM('draft', 'queued', 'sending', 'sent', 'failed', 'cancelled'),
      defaultValue: 'draft',
      allowNull: false
    },
    successCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    failureCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    failureDetails: { type: DataTypes.JSONB, defaultValue: [] },
    sentBy: { type: DataTypes.STRING, defaultValue: '' },
    sentAt: { type: DataTypes.DATE, allowNull: true }
  },
  {
    tableName: 'broadcasts',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['status', 'scheduledAt'] },
      { fields: ['sentBy'] }
    ]
  }
);

module.exports = Broadcast;
