import { useEffect, useMemo, useState } from 'react';
import { fetchMonthAvailability, fetchDayAvailability } from '../context/api';
import './BookingCalendar.css';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function BookingCalendar({ service, selectedDate, selectedTime, onPick }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [monthData, setMonthData] = useState(null);
  const [dayData, setDayData] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const today = todayStr();

  useEffect(() => {
    let aborted = false;
    setLoadingMonth(true);
    fetchMonthAvailability(cursor.year, cursor.month, service)
      .then(d => { if (!aborted) setMonthData(d); })
      .catch(() => { if (!aborted) setMonthData({ days: [] }); })
      .finally(() => { if (!aborted) setLoadingMonth(false); });
    return () => { aborted = true; };
  }, [cursor.year, cursor.month, service]);

  useEffect(() => {
    if (!selectedDate) { setDayData(null); return; }
    let aborted = false;
    setLoadingDay(true);
    fetchDayAvailability(selectedDate, service)
      .then(d => { if (!aborted) setDayData(d); })
      .catch(() => { if (!aborted) setDayData(null); })
      .finally(() => { if (!aborted) setLoadingDay(false); });
    return () => { aborted = true; };
  }, [selectedDate, service]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month - 1, 1));
    const leading = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;
    const byDate = {};
    (monthData?.days || []).forEach(d => { byDate[d.date] = d; });
    const arr = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - leading + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        arr.push({ empty: true });
      } else {
        const dateStr = `${cursor.year}-${pad(cursor.month)}-${pad(dayNum)}`;
        const info = byDate[dateStr];
        arr.push({
          date: dateStr,
          dayNum,
          isOpen: info?.isOpen ?? false,
          total: info?.totalSlots ?? 0,
          available: info?.availableSlots ?? 0,
          booked: (info?.bookings || []).length,
          isPast: dateStr < today,
          isToday: dateStr === today
        });
      }
    }
    return arr;
  }, [cursor, monthData, today]);

  const move = (delta) => {
    setCursor(prev => {
      const m = prev.month + delta;
      const year = prev.year + Math.floor((m - 1) / 12);
      const month = ((m - 1) % 12 + 12) % 12 + 1;
      return { year, month };
    });
  };

  const cellClass = (cell) => {
    if (cell.empty) return 'cal-cell cal-empty';
    const classes = ['cal-cell'];
    if (cell.isToday) classes.push('cal-today');
    if (cell.isPast) classes.push('cal-past');
    if (!cell.isOpen) classes.push('cal-closed');
    else if (cell.available === 0 && cell.total > 0) classes.push('cal-full');
    else if (cell.booked > 0) classes.push('cal-partial');
    if (selectedDate === cell.date) classes.push('cal-selected');
    return classes.join(' ');
  };

  const canSelect = (cell) => cell && !cell.empty && !cell.isPast && cell.isOpen && cell.available > 0;

  return (
    <div className="booking-calendar">
      <div className="cal-header">
        <button type="button" className="cal-nav" onClick={() => move(-1)} aria-label="上個月">‹</button>
        <div className="cal-title">
          <span className="cal-title-en">{MONTH_LABELS[cursor.month - 1]}</span>
          <span className="cal-title-year">{cursor.year}</span>
        </div>
        <button type="button" className="cal-nav" onClick={() => move(1)} aria-label="下個月">›</button>
      </div>

      {loadingMonth && <div className="cal-loading">載入行事曆中⋯</div>}

      <div className="cal-weekdays">
        {WEEKDAYS.map(w => <div key={w} className="cal-weekday">{w}</div>)}
      </div>

      <div className="cal-grid">
        {cells.map((cell, i) => {
          if (cell.empty) return <div key={i} className="cal-cell cal-empty" />;
          const selectable = canSelect(cell);
          return (
            <button
              key={cell.date}
              type="button"
              className={cellClass(cell)}
              disabled={!selectable}
              onClick={() => selectable && onPick(cell.date, null)}
            >
              <span className="cal-daynum">{cell.dayNum}</span>
              {cell.isOpen && cell.total > 0 && (
                <span className="cal-meta">
                  {cell.available > 0
                    ? `${cell.available} 個時段`
                    : '已滿'}
                </span>
              )}
              {!cell.isOpen && <span className="cal-meta cal-meta-closed">公休</span>}
              {cell.booked > 0 && (
                <span className="cal-x" aria-hidden>✕</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><span className="dot dot-open" /> 可預約</span>
        <span><span className="dot dot-partial" /> 部分時段</span>
        <span><span className="dot dot-full" /> 已滿</span>
        <span><span className="dot dot-closed" /> 公休</span>
      </div>

      {selectedDate && (
        <div className="cal-slots">
          <div className="cal-slots-head">
            <span className="cal-slots-label">{selectedDate}</span>
            {dayData?.duration && (
              <span className="cal-slots-duration">每次約 {dayData.duration} 分鐘</span>
            )}
          </div>
          {loadingDay && <div className="cal-loading">讀取時段中⋯</div>}
          {!loadingDay && dayData && (
            dayData.isOpen && dayData.slots.length ? (
              <div className="cal-slot-grid">
                {dayData.slots.map(slot => {
                  const isSelected = selectedTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className={
                        'cal-slot' +
                        (isSelected ? ' cal-slot-selected' : '') +
                        (!slot.available ? ' cal-slot-disabled' : '')
                      }
                      disabled={!slot.available}
                      onClick={() => slot.available && onPick(selectedDate, slot.time)}
                      title={slot.reason === 'booked' ? '已被預約' : slot.reason === 'past' ? '已過時段' : ''}
                    >
                      <span className="cal-slot-time">{slot.time}</span>
                      {!slot.available && <span className="cal-slot-x" aria-hidden>✕</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="cal-slots-empty">當日公休，請挑選其他日期</div>
            )
          )}
        </div>
      )}
    </div>
  );
}
