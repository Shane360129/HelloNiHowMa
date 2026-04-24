import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMonthAvailability } from '../context/api';
import './HomeScheduleCalendar.css';

const MON_FIRST = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTH_LABELS_EN = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

function pad(n) { return String(n).padStart(2, '0'); }
function mondayFirstIndex(sundayIndex) { return (sundayIndex + 6) % 7; }

export default function HomeScheduleCalendar() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [monthData, setMonthData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    fetchMonthAvailability(cursor.year, cursor.month)
      .then(d => { if (!aborted) setMonthData(d); })
      .catch(() => { if (!aborted) setMonthData({ days: [] }); })
      .finally(() => { if (!aborted) setLoading(false); });
    return () => { aborted = true; };
  }, [cursor.year, cursor.month]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month - 1, 1));
    const leading = mondayFirstIndex(first.getUTCDay());
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
          chainSlots: info?.chainSlots || [],
          available: info?.availableSlots ?? 0,
          total: info?.totalSlots ?? 0
        });
      }
    }
    return arr;
  }, [cursor, monthData]);

  const move = (delta) => setCursor(prev => {
    const m = prev.month + delta;
    const year = prev.year + Math.floor((m - 1) / 12);
    const month = ((m - 1) % 12 + 12) % 12 + 1;
    return { year, month };
  });

  return (
    <div className="home-schedule">
      <div className="hs-paper">
        <div className="hs-header">
          <button type="button" className="hs-nav" onClick={() => move(-1)} aria-label="上個月">‹</button>
          <div className="hs-title">
            <span className="hs-month">{MONTH_LABELS_EN[cursor.month - 1]}</span>
            <span className="hs-year">{cursor.year}</span>
          </div>
          <button type="button" className="hs-nav" onClick={() => move(1)} aria-label="下個月">›</button>
        </div>

        <div className="hs-weekdays">
          {MON_FIRST.map(w => <div key={w} className="hs-weekday">{w}</div>)}
        </div>

        <div className="hs-grid">
          {cells.map((cell, i) => {
            if (cell.empty) return <div key={i} className="hs-cell hs-empty" />;
            const full = cell.isOpen && cell.chainSlots.length > 0 && cell.chainSlots.every(s => s.booked);
            return (
              <div key={cell.date} className={`hs-cell${cell.isOpen ? '' : ' hs-closed'}${full ? ' hs-full' : ''}`}>
                <span className="hs-daynum">{cell.dayNum}</span>
                {!cell.isOpen ? (
                  <span className="hs-note hs-closed-note">公休</span>
                ) : cell.chainSlots.length === 0 ? (
                  <span className="hs-note hs-closed-note">—</span>
                ) : (
                  cell.chainSlots.map(slot => (
                    <span
                      key={slot.time}
                      className={`hs-slot${slot.booked ? ' hs-slot-booked' : ''}`}
                    >
                      {slot.time}
                      {slot.booked && <span className="hs-slot-x">✕</span>}
                    </span>
                  ))
                )}
              </div>
            );
          })}
        </div>

        {loading && <div className="hs-loading">載入中⋯</div>}

        <div className="hs-footer">
          <p className="hs-hint">＊ 如欲預約，請使用線上表單或私訊 IG／LINE</p>
          <p className="hs-hint">＊ 實際時段以確認通知為準・感謝您的支持</p>
          <Link to="/booking" className="btn btn-sm">前往線上預約</Link>
        </div>
      </div>
    </div>
  );
}
