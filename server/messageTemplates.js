const MessageTemplate = require('./models/MessageTemplate');
const Setting = require('./models/Setting');
const Profile = require('./models/Profile');

// ====== Flex Message templates ======

const STORE_BOOKING_FLEX = {
  type: 'bubble',
  body: {
    type: 'box',
    layout: 'vertical',
    contents: [
      { type: 'text', text: '📅 新預約通知', weight: 'bold', size: 'lg', color: '#A88158' },
      { type: 'separator', margin: 'md' },
      {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '{name}', size: 'lg', weight: 'bold' },
          { type: 'text', text: '📞 {phone}', size: 'sm', color: '#666666' },
          { type: 'text', text: '💄 {service} · {duration} 分', size: 'sm', color: '#666666', wrap: true },
          { type: 'text', text: '📅 {date}', size: 'sm', color: '#666666' },
          { type: 'text', text: '⏰ {time} - {endTime}', size: 'sm', color: '#666666' },
          { type: 'text', text: '備註：{notes}', size: 'sm', color: '#888888', wrap: true, margin: 'xs' }
        ]
      }
    ]
  },
  footer: {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: [
      {
        type: 'button',
        style: 'primary',
        color: '#06c755',
        action: {
          type: 'postback',
          label: '✅ 確認預約',
          data: 'action=booking_confirm&id={bookingId}',
          displayText: '確認 {name} 的預約'
        }
      },
      {
        type: 'button',
        style: 'secondary',
        action: {
          type: 'postback',
          label: '❌ 取消預約',
          data: 'action=booking_cancel&id={bookingId}',
          displayText: '取消 {name} 的預約'
        }
      }
    ]
  }
};

const OA_WELCOME_FLEX = {
  type: 'bubble',
  body: {
    type: 'box',
    layout: 'vertical',
    contents: [
      { type: 'text', text: '✨ 歡迎加入 {storeName}', weight: 'bold', size: 'lg', color: '#A88158', wrap: true },
      { type: 'text', text: '{name} 您好，', size: 'md', margin: 'md' },
      {
        type: 'text',
        text: '歡迎加入我們的官方帳號 💕\n\n您可以從下方選單預約、查看作品集，或直接輸入「預約」開始喔 ✨',
        wrap: true,
        size: 'sm',
        margin: 'sm',
        color: '#666666'
      }
    ]
  }
};

// ====== Default seeded templates ======

const DEFAULT_TEMPLATES = [
  {
    key: 'booking_created_customer',
    name: '預約成立（給客戶）',
    description: '客戶自助送出預約後立即收到的確認訊息（D2：後台代客建立不發此訊息）',
    channel: 'line_text',
    enabled: true,
    content:
      '{name} 您好 ✨\n我們已收到您的預約申請，將盡快與您確認時段\n\n💄 {service}\n📅 {date} {time}\n\n預約管理：https://lapaisley.com/me/bookings',
    variables: ['name', 'service', 'date', 'time', 'phone', 'notes', 'storeName']
  },
  {
    key: 'booking_created_store',
    name: '預約成立（給店家）',
    description: '客戶自助預約時推給店家的 Flex Message，含一鍵確認 / 取消按鈕（D4）',
    channel: 'line_flex',
    enabled: true,
    content: '新預約通知 - {name} {date} {time}',
    flexJson: STORE_BOOKING_FLEX,
    variables: [
      'name', 'phone', 'service', 'date', 'time',
      'endTime', 'duration', 'notes', 'bookingId'
    ]
  },
  {
    key: 'booking_confirmed_customer',
    name: '預約確認（給客戶）',
    description: '店家標記為「已確認」時推給客戶；後台代客預約轉為已確認也走此模板',
    channel: 'line_text',
    enabled: true,
    content:
      '{name} 您好！您的預約已確認 ✨\n\n💄 {service}\n📅 {date} {time}\n📍 {storeAddress}\n\n期待與您相見 💕',
    variables: ['name', 'service', 'date', 'time', 'storeAddress', 'storePhone']
  },
  {
    key: 'booking_cancelled_customer',
    name: '預約取消（給客戶）',
    description: '預約被取消時通知客戶',
    channel: 'line_text',
    enabled: true,
    content:
      '{name} 您好，\n您 {date} {time} 的 {service} 預約已取消。\n\n如需重新預約請至：https://lapaisley.com/booking\n或直接回覆此訊息與我們聯絡。',
    variables: ['name', 'service', 'date', 'time']
  },
  {
    key: 'booking_completed_customer',
    name: '預約完成（給客戶）',
    description: '服務完成後的感謝訊息（預設停用，可在後台啟用）',
    channel: 'line_text',
    enabled: false,
    content:
      '{name} 您好，\n感謝您光臨 {storeName} 💕\n\n若眉型有任何不適或需要調整，歡迎隨時回覆此訊息。期待下次再見 ✨',
    variables: ['name', 'storeName']
  },
  {
    key: 'booking_reminder',
    name: '預約提醒（前一天）',
    description: '排程在預約前一天發送的提醒訊息（時間依系統設定 reminderTime）',
    channel: 'line_text',
    enabled: true,
    content:
      '{name} 您好 ✨\n提醒您 明日（{date}）{time} 有一場預約：\n\n💄 {service}（{duration} 分）\n📍 {storeAddress}\n\n如需取消請至「我的預約」頁面，或回覆此訊息與我們聯絡。',
    variables: ['name', 'service', 'date', 'time', 'duration', 'storeAddress']
  },
  {
    key: 'oa_welcome',
    name: 'OA 加入歡迎',
    description: '新追蹤者首次加入官方帳號時自動發送的 Flex 卡片',
    channel: 'line_flex',
    enabled: true,
    content: '歡迎加入 {storeName} ✨',
    flexJson: OA_WELCOME_FLEX,
    variables: ['name', 'storeName']
  }
];

async function ensureDefaultTemplates() {
  let created = 0;
  for (const def of DEFAULT_TEMPLATES) {
    const [, isNew] = await MessageTemplate.findOrCreate({
      where: { key: def.key },
      defaults: def
    });
    if (isNew) created++;
  }
  if (created > 0) console.log(`[templates] seeded ${created} default template(s)`);
}

// ====== Variable substitution ======

function substituteString(text, vars) {
  if (typeof text !== 'string') return text;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    text
  );
}

async function renderTemplate(key, vars) {
  const tpl = await MessageTemplate.findOne({ where: { key } });
  if (!tpl || !tpl.enabled) return null;
  if (tpl.channel === 'line_flex' && tpl.flexJson) {
    try {
      const jsonStr = JSON.stringify(tpl.flexJson);
      const replaced = substituteString(jsonStr, vars);
      return {
        type: 'flex',
        altText: substituteString(tpl.content || tpl.name, vars).slice(0, 400),
        contents: JSON.parse(replaced)
      };
    } catch (err) {
      console.error(`[templates] flex render failed for ${key}:`, err.message);
      return null;
    }
  }
  return { type: 'text', text: substituteString(tpl.content, vars) };
}

// ====== Booking → template variables ======

function computeEndTime(time, durationMin) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const total = h * 60 + m + (Number(durationMin) || 0);
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

async function buildBookingVars(booking) {
  const [profile, settings] = await Promise.all([
    Profile.findOne(),
    Setting.findOne()
  ]);
  return {
    name: booking.name || '',
    phone: booking.phone || '',
    service: booking.service || '',
    date: booking.date || '',
    time: booking.time || '',
    endTime: computeEndTime(booking.time, booking.durationMinutes),
    duration: booking.durationMinutes || 0,
    notes: booking.notes || '無',
    bookingId: booking.id,
    storeName: settings?.businessName || profile?.name || 'La Paisley',
    storeAddress: profile?.address || '',
    storePhone: profile?.phone || ''
  };
}

module.exports = {
  DEFAULT_TEMPLATES,
  ensureDefaultTemplates,
  renderTemplate,
  buildBookingVars,
  computeEndTime,
  substituteString
};
