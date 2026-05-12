const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../db');

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // LINE 識別碼。走入/電話/私訊客戶可為 NULL（D8）
    lineUserId: { type: DataTypes.STRING(64), allowNull: true },

    // 用戶來源
    source: {
      type: DataTypes.ENUM('line', 'walk_in', 'phone', 'dm'),
      allowNull: false,
      defaultValue: 'line'
    },

    // LINE Profile 同步資料
    displayName: { type: DataTypes.STRING, allowNull: false },
    pictureUrl: { type: DataTypes.STRING, defaultValue: '' },
    statusMessage: { type: DataTypes.STRING, defaultValue: '' },
    language: { type: DataTypes.STRING, defaultValue: 'zh-TW' },

    // 預約時補填 / 離線客戶必填
    email: { type: DataTypes.STRING, defaultValue: '' },
    phone: { type: DataTypes.STRING, defaultValue: '' },

    // OA 互動
    isFollowingOA: { type: DataTypes.BOOLEAN, defaultValue: false },

    // 個人偏好
    reminderOptIn: { type: DataTypes.BOOLEAN, defaultValue: true }, // D9

    // 後台管理
    tags: { type: DataTypes.JSONB, defaultValue: [] },
    notes: { type: DataTypes.TEXT, defaultValue: '' },
    blocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdByAdminId: { type: DataTypes.INTEGER, allowNull: true },

    lastLoginAt: { type: DataTypes.DATE, allowNull: true }
  },
  {
    tableName: 'users',
    timestamps: true,
    indexes: [
      // 部分唯一索引：只在 lineUserId 不為 NULL 時強制唯一
      {
        name: 'users_line_user_id_unique_idx',
        unique: true,
        fields: ['lineUserId'],
        where: { lineUserId: { [Op.not]: null } }
      },
      { fields: ['phone'] },
      { fields: ['source'] }
    ]
  }
);

module.exports = User;
