const { AdminAuditLog } = require('./models');

// 同步寫入 audit log。失敗時記錄到 console 但**不**拋出，避免主要操作受影響。
async function logAdmin(req, action, targetType, targetId, diff) {
  try {
    await AdminAuditLog.create({
      adminId: req?.user?.sub ? Number(req.user.sub) : null,
      adminUsername: req?.user?.username || '',
      action,
      targetType: targetType || null,
      targetId: targetId != null ? String(targetId) : null,
      diff: diff || {},
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent']?.slice(0, 200) || null
    });
  } catch (err) {
    console.error('[audit]', err.message);
  }
}

// 給 webhook postback 等場景：操作者是 LINE userId 而不是 admin
async function logFromLine(action, lineUserId, targetType, targetId, diff) {
  try {
    await AdminAuditLog.create({
      adminId: null,
      adminUsername: 'LINE:' + (lineUserId || '').slice(0, 12),
      action,
      targetType: targetType || null,
      targetId: targetId != null ? String(targetId) : null,
      diff: diff || {},
      ip: 'via-line-webhook',
      userAgent: null
    });
  } catch (err) {
    console.error('[audit]', err.message);
  }
}

module.exports = { logAdmin, logFromLine };
