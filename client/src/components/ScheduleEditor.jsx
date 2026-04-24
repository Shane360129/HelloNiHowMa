import { useMemo } from 'react';

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function generateHalfHours() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}
const HALF_HOURS = generateHalfHours();
const SLOT_INTERVAL = 30;

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function countSlots(start, end, duration) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s == null || e == null || e <= s) return 0;
  let count = 0;
  for (let t = s; t + duration <= e; t += SLOT_INTERVAL) count++;
  return count;
}

function safeParse(str, fallback) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}

function normalizeWeekly(parsed) {
  const out = {};
  for (let i = 0; i < 7; i++) {
    const v = parsed[i] ?? parsed[String(i)] ?? null;
    if (!v) out[i] = null;
    else if (Array.isArray(v)) out[i] = v.length ? v : null;
    else out[i] = [v];
  }
  return out;
}

function TimeSelect({ value, onChange }) {
  return (
    <select className="schedule-time-select" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>--:--</option>
      {HALF_HOURS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

export default function ScheduleEditor({ settings, onChange }) {
  const weekly = useMemo(
    () => normalizeWeekly(safeParse(settings.weeklySchedule, {})),
    [settings.weeklySchedule]
  );
  const overrides = useMemo(
    () => safeParse(settings.dateOverrides, {}),
    [settings.dateOverrides]
  );
  const duration = Number(settings.defaultBookingDuration ?? 210);

  const saveWeekly = (next) => onChange('weeklySchedule', JSON.stringify(next));
  const saveOverrides = (next) => onChange('dateOverrides', JSON.stringify(next));

  const toggleDay = (dow, open) => {
    const next = { ...weekly };
    next[dow] = open ? [{ start: '09:30', end: '20:00' }] : null;
    saveWeekly(next);
  };

  const updateRange = (dow, idx, field, value) => {
    const next = { ...weekly };
    const ranges = [...(next[dow] || [])];
    ranges[idx] = { ...ranges[idx], [field]: value };
    next[dow] = ranges;
    saveWeekly(next);
  };

  const addRange = (dow) => {
    const next = { ...weekly };
    const ranges = [...(next[dow] || [])];
    ranges.push({ start: '14:00', end: '18:00' });
    next[dow] = ranges;
    saveWeekly(next);
  };

  const removeRange = (dow, idx) => {
    const next = { ...weekly };
    const ranges = [...(next[dow] || [])];
    ranges.splice(idx, 1);
    next[dow] = ranges.length ? ranges : null;
    saveWeekly(next);
  };

  const overrideKeys = Object.keys(overrides).sort();

  const addOverride = () => {
    const today = new Date().toISOString().slice(0, 10);
    let d = today;
    let i = 0;
    while (overrides[d] !== undefined && i < 365) {
      const dt = new Date(d);
      dt.setDate(dt.getDate() + 1);
      d = dt.toISOString().slice(0, 10);
      i++;
    }
    saveOverrides({ ...overrides, [d]: [{ start: '14:00', end: '20:00' }] });
  };

  const setOverrideDate = (oldDate, newDate) => {
    if (!newDate || newDate === oldDate) return;
    const next = { ...overrides };
    next[newDate] = next[oldDate];
    delete next[oldDate];
    saveOverrides(next);
  };
  const setOverrideClosed = (date) => saveOverrides({ ...overrides, [date]: null });
  const setOverrideOpen = (date) => saveOverrides({ ...overrides, [date]: [{ start: '14:00', end: '20:00' }] });
  const updateOverrideRange = (date, idx, field, value) => {
    const ranges = Array.isArray(overrides[date]) ? [...overrides[date]] : [];
    ranges[idx] = { ...ranges[idx], [field]: value };
    saveOverrides({ ...overrides, [date]: ranges });
  };
  const addOverrideRange = (date) => {
    const ranges = Array.isArray(overrides[date]) ? [...overrides[date]] : [];
    ranges.push({ start: '14:00', end: '18:00' });
    saveOverrides({ ...overrides, [date]: ranges });
  };
  const removeOverrideRange = (date, idx) => {
    const ranges = Array.isArray(overrides[date]) ? [...overrides[date]] : [];
    ranges.splice(idx, 1);
    saveOverrides({ ...overrides, [date]: ranges.length ? ranges : null });
  };
  const removeOverride = (date) => {
    const next = { ...overrides };
    delete next[date];
    saveOverrides(next);
  };

  const daySlotCount = (ranges) => {
    if (!ranges) return 0;
    return ranges.reduce((acc, r) => acc + countSlots(r.start, r.end, duration), 0);
  };

  return (
    <div className="schedule-editor">
      <div className="schedule-note">
        <strong>如何設定：</strong>選擇「開放」後，用下拉選單挑開始與結束時間（半小時為單位）。
        系統會依預約時長 <strong>{duration} 分鐘</strong> 自動產生可預約的時段；每個時段間距為 30 分鐘。
      </div>

      <h4>每週固定時段</h4>
      <div className="schedule-weekly">
        {WEEKDAY_LABELS.map((label, dow) => {
          const ranges = weekly[dow];
          const open = !!ranges && ranges.length > 0;
          const slots = daySlotCount(ranges);
          return (
            <div key={dow} className="schedule-row">
              <label className="schedule-day">
                <input
                  type="checkbox"
                  checked={open}
                  onChange={e => toggleDay(dow, e.target.checked)}
                />
                <span>{label}</span>
              </label>
              <div className="schedule-ranges">
                {open ? ranges.map((r, idx) => (
                  <div key={idx} className="schedule-range">
                    <TimeSelect value={r.start} onChange={v => updateRange(dow, idx, 'start', v)} />
                    <span className="range-sep">—</span>
                    <TimeSelect value={r.end} onChange={v => updateRange(dow, idx, 'end', v)} />
                    {ranges.length > 1 && (
                      <button type="button" className="schedule-mini-btn" onClick={() => removeRange(dow, idx)}>×</button>
                    )}
                  </div>
                )) : <span className="schedule-closed">公休</span>}
                {open && (
                  <button type="button" className="schedule-add" onClick={() => addRange(dow)}>+ 新增區間</button>
                )}
              </div>
              <span className={'schedule-count' + (open ? '' : ' schedule-count-muted')}>
                {open ? `${slots} 個時段` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <h4 style={{ marginTop: '1.5rem' }}>特殊日期調整</h4>
      <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
        覆蓋某一天的設定，例如「臨時公休」或「當天下午才開放」。
      </p>
      <div className="schedule-overrides">
        {overrideKeys.length === 0 && (
          <div className="empty-state" style={{ padding: '0.75rem' }}>尚無特殊日期設定</div>
        )}
        {overrideKeys.map(date => {
          const ov = overrides[date];
          const closed = ov === null || ov === undefined;
          const ranges = Array.isArray(ov) ? ov : [];
          const slots = daySlotCount(ranges);
          return (
            <div key={date} className="override-row">
              <input
                type="date"
                value={date}
                onChange={e => setOverrideDate(date, e.target.value)}
              />
              {closed ? (
                <>
                  <span className="schedule-closed">公休一日</span>
                  <button type="button" className="schedule-add" onClick={() => setOverrideOpen(date)}>改為開放</button>
                </>
              ) : (
                <div className="schedule-ranges">
                  {ranges.map((r, idx) => (
                    <div key={idx} className="schedule-range">
                      <TimeSelect value={r.start} onChange={v => updateOverrideRange(date, idx, 'start', v)} />
                      <span className="range-sep">—</span>
                      <TimeSelect value={r.end} onChange={v => updateOverrideRange(date, idx, 'end', v)} />
                      {ranges.length > 1 && (
                        <button type="button" className="schedule-mini-btn" onClick={() => removeOverrideRange(date, idx)}>×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="schedule-add" onClick={() => addOverrideRange(date)}>+ 新增區間</button>
                  <button type="button" className="schedule-add" onClick={() => setOverrideClosed(date)}>改為公休</button>
                </div>
              )}
              {!closed && <span className="schedule-count">{slots} 個時段</span>}
              <button type="button" className="schedule-mini-btn schedule-mini-danger" onClick={() => removeOverride(date)}>刪除</button>
            </div>
          );
        })}
        <button type="button" className="schedule-add" onClick={addOverride} style={{ marginTop: '0.75rem' }}>
          + 新增特殊日期
        </button>
      </div>

      <h4 style={{ marginTop: '1.5rem' }}>預約時長</h4>
      <div className="form-row">
        <div className="form-group">
          <label>每筆預約鎖定時長（分鐘）</label>
          <input
            type="number"
            min="30"
            step="30"
            value={duration}
            onChange={e => onChange('defaultBookingDuration', Number(e.target.value))}
          />
          <p className="form-hint">預設 210 分鐘（3.5 小時）。訂下去後下一個可預約時段會跳這麼久後。</p>
        </div>
      </div>
    </div>
  );
}
