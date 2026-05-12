// La Paisley 預約提醒 Cron
//
// 排程：建議每整點執行一次（render.yaml: "0 * * * *"）。
// 行為：讀 settings.reminderTime 與 reminderLeadDays，現在時間對得上才實際發送，
//      否則直接退出。這樣店家可在後台改提醒時間，不需重新部署。

const { Op } = require('sequelize');
const { connectDB, sequelize } = require('../db');
const { Booking, User, Setting } = require('../models');
const { pushTemplate } = require('../line');
const { buildBookingVars } = require('../messageTemplates');

const TZ_OFFSET_MINUTES = Number(process.env.BOOKING_TZ_OFFSET_MINUTES ?? 480);

function nowInTz() {
  return new Date(Date.now() + TZ_OFFSET_MINUTES * 60 * 1000);
}

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

async function run() {
  await connectDB({ sync: false });

  const settings = await Setting.findOne();
  if (!settings) {
    console.log('[reminders] no settings row, abort');
    return;
  }
  if (settings.reminderEnabled === false) {
    console.log('[reminders] disabled by settings');
    return;
  }

  const now = nowInTz();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const [targetH, targetM] = (settings.reminderTime || '10:00').split(':').map(Number);

  if (currentHour !== targetH) {
    console.log(`[reminders] current hour ${currentHour} != target ${targetH}, skip`);
    return;
  }
  // 只在目標時間的整點起 30 分鐘內執行（避免錯過或重發）
  if (currentMinute > 30) {
    console.log(`[reminders] outside 30 min window (now=${currentMinute}), skip`);
    return;
  }
  if (currentMinute < targetM - 5) {
    // 設定 10:30 但現在才 10:00 → 等下個整點再說（不太可能發生因 schedule 整點觸發）
    console.log(`[reminders] before target minute ${targetM}, skip`);
    return;
  }

  const leadDays = settings.reminderLeadDays ?? 1;
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + leadDays);
  const targetDate = toDateString(target);

  console.log(`[reminders] looking for bookings on ${targetDate}`);

  const bookings = await Booking.findAll({
    where: {
      date: targetDate,
      status: { [Op.in]: ['pending', 'confirmed'] },
      reminderSentAt: null,
      userId: { [Op.ne]: null }
    },
    include: [{ model: User, as: 'user' }]
  });

  console.log(`[reminders] ${bookings.length} candidate booking(s)`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const booking of bookings) {
    const user = booking.user;
    // 沒 LINE userId 或客戶選擇關閉提醒 → 標記為已處理避免下次重撈
    if (!user || !user.lineUserId || user.reminderOptIn === false || user.blocked) {
      await booking.update({ reminderSentAt: new Date() });
      skipped++;
      continue;
    }
    try {
      const vars = await buildBookingVars(booking);
      await pushTemplate(user.lineUserId, 'booking_reminder', vars);
      await booking.update({ reminderSentAt: new Date() });
      sent++;
    } catch (err) {
      console.error(`[reminders] failed for booking ${booking.id}:`, err.message);
      failed++;
    }
  }

  console.log(`[reminders] done: sent=${sent} skipped=${skipped} failed=${failed}`);
  await sequelize.close();
}

run().catch(err => {
  console.error('[reminders] fatal:', err);
  process.exit(1);
});
