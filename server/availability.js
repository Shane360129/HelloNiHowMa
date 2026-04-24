const Setting = require('./models/Setting');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const { Op } = require('sequelize');

function safeParse(str, fallback) {
  if (!str) return fallback;
  try {
    const parsed = typeof str === 'string' ? JSON.parse(str) : str;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function dayOfWeek(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

const TZ_OFFSET_MINUTES = Number(process.env.BOOKING_TZ_OFFSET_MINUTES ?? 480);

function nowInBusinessTz() {
  return new Date(Date.now() + TZ_OFFSET_MINUTES * 60 * 1000);
}

async function loadSchedule() {
  const s = await Setting.findOne();
  return {
    weekly: safeParse(s?.weeklySchedule, {}),
    overrides: safeParse(s?.dateOverrides, {}),
    defaultDuration: s?.defaultBookingDuration || 180,
    slotInterval: s?.slotInterval || 60,
    bookingEnabled: s?.bookingEnabled !== false
  };
}

function getOpenRanges(dateStr, schedule) {
  if (Object.prototype.hasOwnProperty.call(schedule.overrides, dateStr)) {
    const ov = schedule.overrides[dateStr];
    if (!ov) return [];
    return Array.isArray(ov) ? ov : [];
  }
  const dow = dayOfWeek(dateStr);
  const weekly = schedule.weekly[dow] ?? schedule.weekly[String(dow)];
  if (!weekly) return [];
  return Array.isArray(weekly) ? weekly : [];
}

async function getServiceDuration(serviceIdOrName, defaultDuration) {
  if (!serviceIdOrName) return defaultDuration;
  let svc = null;
  if (/^\d+$/.test(String(serviceIdOrName))) {
    svc = await Service.findByPk(Number(serviceIdOrName));
  }
  if (!svc) {
    svc = await Service.findOne({ where: { name: String(serviceIdOrName) } });
  }
  if (!svc) return defaultDuration;
  return svc.durationMinutes || defaultDuration;
}

async function getBookingsForDates(dates) {
  if (!dates.length) return [];
  const rows = await Booking.findAll({
    where: {
      date: { [Op.in]: dates },
      status: { [Op.ne]: 'cancelled' }
    }
  });
  return rows.map(r => r.toJSON());
}

function bookingToRange(booking, defaultDuration) {
  const start = timeToMinutes(booking.time);
  if (start == null) return null;
  const dur = booking.durationMinutes || defaultDuration;
  return { start, end: start + dur, service: booking.service, time: booking.time };
}

function computeDaySlots({ dateStr, duration, schedule, bookings, now }) {
  const openRanges = getOpenRanges(dateStr, schedule);
  if (!openRanges.length) {
    return { isOpen: false, openRanges: [], slots: [], chainSlots: [], bookings: [] };
  }

  const bookedRanges = bookings
    .map(b => bookingToRange(b, schedule.defaultDuration))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const slots = [];
  const chainSlots = [];
  const interval = Math.max(15, schedule.slotInterval || 60);
  const todayStr = now.toISOString().slice(0, 10);
  const nowMinutes = dateStr === todayStr
    ? now.getUTCHours() * 60 + now.getUTCMinutes()
    : dateStr < todayStr ? Infinity : -Infinity;

  for (const range of openRanges) {
    const rStart = timeToMinutes(range.start);
    const rEnd = timeToMinutes(range.end);
    if (rStart == null || rEnd == null || rEnd <= rStart) continue;

    for (let t = rStart; t + duration <= rEnd; t += interval) {
      const slotEnd = t + duration;
      const conflict = bookedRanges.find(b => b.start < slotEnd && b.end > t);
      const past = t <= nowMinutes;
      slots.push({
        time: minutesToTime(t),
        endTime: minutesToTime(slotEnd),
        available: !conflict && !past,
        reason: past ? 'past' : conflict ? 'booked' : null
      });
    }

    for (let t = rStart; t + duration <= rEnd; t += duration) {
      const slotEnd = t + duration;
      const conflict = bookedRanges.find(b => b.start < slotEnd && b.end > t);
      chainSlots.push({
        time: minutesToTime(t),
        endTime: minutesToTime(slotEnd),
        booked: !!conflict
      });
    }
  }

  return {
    isOpen: true,
    openRanges,
    slots,
    chainSlots,
    bookings: bookedRanges.map(b => ({
      time: b.time,
      endTime: minutesToTime(b.end),
      service: b.service
    }))
  };
}

async function getDayAvailability(dateStr, serviceIdentifier) {
  const schedule = await loadSchedule();
  const duration = await getServiceDuration(serviceIdentifier, schedule.defaultDuration);
  const bookings = await getBookingsForDates([dateStr]);
  const result = computeDaySlots({
    dateStr,
    duration,
    schedule,
    bookings,
    now: nowInBusinessTz()
  });
  return { date: dateStr, duration, bookingEnabled: schedule.bookingEnabled, ...result };
}

async function getMonthAvailability(year, month, serviceIdentifier) {
  const schedule = await loadSchedule();
  const duration = await getServiceDuration(serviceIdentifier, schedule.defaultDuration);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  const bookings = await getBookingsForDates(dates);
  const bookingsByDate = bookings.reduce((acc, b) => {
    (acc[b.date] ||= []).push(b);
    return acc;
  }, {});
  const now = nowInBusinessTz();
  const days = dates.map(dateStr => {
    const d = computeDaySlots({
      dateStr,
      duration,
      schedule,
      bookings: bookingsByDate[dateStr] || [],
      now
    });
    const availableCount = d.slots.filter(s => s.available).length;
    return {
      date: dateStr,
      isOpen: d.isOpen,
      openRanges: d.openRanges,
      chainSlots: d.chainSlots,
      totalSlots: d.slots.length,
      availableSlots: availableCount,
      bookings: d.bookings
    };
  });
  return { year, month, duration, bookingEnabled: schedule.bookingEnabled, days };
}

async function validateBookingSlot({ date, time, service }) {
  const schedule = await loadSchedule();
  if (!schedule.bookingEnabled) {
    return { ok: false, error: '目前暫停線上預約' };
  }
  const duration = await getServiceDuration(service, schedule.defaultDuration);
  const bookings = await getBookingsForDates([date]);
  const day = computeDaySlots({
    dateStr: date,
    duration,
    schedule,
    bookings,
    now: nowInBusinessTz()
  });
  if (!day.isOpen) return { ok: false, error: '該日期並未開放預約' };
  const slot = day.slots.find(s => s.time === time);
  if (!slot) return { ok: false, error: '此時段不在可預約的時刻表內' };
  if (!slot.available) {
    if (slot.reason === 'booked') return { ok: false, error: '此時段已被預約' };
    if (slot.reason === 'past') return { ok: false, error: '此時段已過' };
    return { ok: false, error: '此時段無法預約' };
  }
  return { ok: true, duration };
}

module.exports = {
  loadSchedule,
  getDayAvailability,
  getMonthAvailability,
  validateBookingSlot,
  timeToMinutes,
  minutesToTime
};
