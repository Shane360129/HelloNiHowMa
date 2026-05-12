const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const LineWebhookEvent = sequelize.define(
  'LineWebhookEvent',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    webhookEventId: { type: DataTypes.STRING, allowNull: false, unique: true },
    type: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    rawPayload: { type: DataTypes.JSONB, allowNull: true },
    processedAt: { type: DataTypes.DATE, allowNull: true }
  },
  {
    tableName: 'line_webhook_events',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['type', 'createdAt'] }
    ]
  }
);

module.exports = LineWebhookEvent;
