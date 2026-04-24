import { useEffect, useMemo, useState } from 'react';
import { fetchMonthAvailability, fetchDayAvailability } from '../context/api';
import './BookingCalendar.css';

const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAY_LABEL_TC = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const WEEKDAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function mondayFirstIndex(sundayIndex) {
  return (sundayIndex + 6) % 7;
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
    const leadingSun = first.getUTCDay();
    const leading = mondayFirstIndex(leadingSun);
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;
    const byDate = {};
    (monthData?.days || []).forEach(d => { byDate[d.date] = d; });
    const arr = [];
    const prevMonthDays = new Date(Date.UTC(cursor.year, cursor.month - 1, 0)).getUTCDate();
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - leading + 1;
      if (dayNum < 1) {
        arr.push({ outside: true, dayNum: prevMonthDays + dayNum });
      } else if (dayNum > daysInMonth) {
        arr.push({ outside: true, dayNum: dayNum - daysInMonth });
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

  const canSelect = (cell) => cell && !cell.outside && !cell.isPast && cell.isOpen && cell.available > 0;

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${WEEKDAY_LABEL_TC[dow]} · ${WEEKDAY_SHORT_EN[dow]}, ${MONTH_LABELS[m - 1].slice(0, 3)} ${d}`;
  }, [selectedDate]);

  const cellClass = (cell) => {
    const classes = ['cal-cell'];
    if (cell.outside) { classes.push('cal-outside'); return classes.join(' '); }
    if (cell.isPast) classes.push('cal-past');
    else if (!cell.isOpen) classes.push('cal-closed');
    else if (cell.available === 0 && cell.total > 0) classes.push('cal-full');
    else {
      classes.push('cal-available');
      if (cell.booked > 0) classes.push('cal-partial');
    }
    if (cell.isToday) classes.push('cal-today');
    if (selectedDate === cell.date) classes.push('cal-selected');
    return classes.join(' ');
  };

  return (
    <div className="booking-calendar">
      <div className="picker-grid">
        <div className="picker-calendar">
          <div className="cal-header">
            <div className="cal-title">
              <span className="cal-title-en">{MONTH_LABELS[cursor.month - 1]}</span>
              <span className="cal-title-year">{cursor.year}</span>
            </div>
            <div className="cal-nav-group">
              <button type="button" className="cal-nav" onClick={() => move(-1)} aria-label="上個月">‹</button>
              <button type="button" className="cal-nav" onClick={() => move(1)} aria-label="下個月">›</button>
            </div>
          </div>

          <div className="cal-weekdays">
            {WEEKDAYS_MON_FIRST.map(w => <div key={w} className="cal-weekday">{w}</div>)}
          </div>

          <div className="cal-grid">
            {cells.map((cell, i) => {
              if (cell.outside) {
                return <div key={i} className="cal-cell cal-outside"><span className="cal-daynum">{cell.dayNum}</span></div>;
              }
              const selectable = canSelect(cell);
              return (
                <button
                  key={cell.date}
                  type="button"
                  className={cellClass(cell)}
                  disabled={!selectable}
                  onClick={() => selectable && onPick(cell.date, null)}
                  title={
                    cell.isPast ? '已過' :
                    !cell.isOpen ? '公休' :
                    cell.available === 0 ? '已額滿' : ''
                  }
                >
                  <span className="cal-daynum">{cell.dayNum}</span>
                  {cell.booked > 0 && cell.available === 0 && (
                    <span className="cal-x" aria-hidden>✕</span>
                  )}
                  {cell.booked > 0 && cell.available > 0 && (
                    <span className="cal-partial-dot" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          {loadingMonth && <div className="cal-loading">載入中⋯</div>}

          <div className="cal-legend">
            <span><span className="dot dot-open" /> 可選</span>
            <span><span className="dot dot-partial" /> 部分時段</span>
            <span><span className="dot dot-full" /> 已滿</span>
            <span><span className="dot dot-closed" /> 公休</span>
          </div>
        </div>

        <div className="picker-slots">
          {!selectedDate ? (
            <div className="slots-empty">
              <p className="slots-hint">請於左側選擇日期</p>
            </div>
          ) : (
            <>
              {loadingDay && <div className="cal-loading">讀取時段中⋯</div>}
              {!loadingDay && dayData && (
                dayData.isOpen && dayData.slots.length ? (
                  <div className="slots-list">
                    <div className="slot-item slot-date-head" aria-hidden>
                      <span className="slot-time">{selectedDateLabel}</span>
                    </div>
                    {dayData.slots.map(slot => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <label
                          key={slot.time}
                          className={
                            'slot-item' +
                            (isSelected ? ' slot-selected' : '') +
                            (!slot.available ? ' slot-disabled' : '')
                          }
                          title={slot.reason === 'booked' ? '已被預約' : slot.reason === 'past' ? '已過時段' : ''}
                        >
                          <input
                            type="radio"
                            name="booking-slot"
                            value={slot.time}
                            checked={isSelected}
                            disabled={!slot.available}
                            onChange={() => slot.available && onPick(selectedDate, slot.time)}
                          />
                          <span className="slot-radio" aria-hidden />
                          <span className="slot-time">{slot.time}</span>
                          {!slot.available && <span className="slot-x" aria-hidden>✕</span>}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="slots-empty">當日公休，請挑選其他日期</div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
