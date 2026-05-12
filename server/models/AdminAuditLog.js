const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const AdminAuditLog = sequelize.define(
  'AdminAuditLog',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    adminId: { type: DataTypes.INTEGER, allowNull: true },
    adminUsername: { type: DataTypes.STRING, defaultValue: '' },
    action: { type: DataTypes.STRING, allowNull: false },
    targetType: { type: DataTypes.STRING, allowNull: true },
    targetId: { type: DataTypes.STRING, allowNull: true },
    diff: { type: DataTypes.JSONB, defaultValue: {} },
    ip: { type: DataTypes.STRING, allowNull: true },
    userAgent: { type: DataTypes.STRING, allowNull: true }
  },
  {
    tableName: 'admin_audit_logs',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['adminId', 'createdAt'] },
      { fields: ['targetType', 'targetId'] },
      { fields: ['action'] }
    ]
  }
);

module.exports = AdminAuditLog;
