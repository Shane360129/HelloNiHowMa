import { useMemo } from 'react';

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

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
    else if (Array.isArray(v)) out[i] = v;
    else out[i] = [v];
  }
  return out;
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

  const saveWeekly = (next) => {
    onChange('weeklySchedule', JSON.stringify(next));
  };
  const saveOverrides = (next) => {
    onChange('dateOverrides', JSON.stringify(next));
  };

  const toggleDay = (dow, open) => {
    const next = { ...weekly };
    next[dow] = open ? [{ start: '11:00', end: '20:00' }] : null;
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
    const today = new Date();
    const d = today.toISOString().slice(0, 10);
    if (overrides[d] !== undefined) return;
    saveOverrides({ ...overrides, [d]: [{ start: '14:00', end: '20:00' }] });
  };

  const setOverrideDate = (oldDate, newDate) => {
    if (!newDate || newDate === oldDate) return;
    const next = { ...overrides };
    next[newDate] = next[oldDate];
    delete next[oldDate];
    saveOverrides(next);
  };

  const setOverrideClosed = (date) => {
    saveOverrides({ ...overrides, [date]: null });
  };

  const setOverrideOpen = (date) => {
    saveOverrides({ ...overrides, [date]: [{ start: '14:00', end: '20:00' }] });
  };

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

  return (
    <div className="schedule-editor">
      <h4>每週固定時段</h4>
      <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
        取消勾選代表該天公休。可為一天設定多個時段區間（如：早上 + 下午）。
      </p>
      <div className="schedule-weekly">
        {WEEKDAY_LABELS.map((label, dow) => {
          const ranges = weekly[dow];
          const open = !!ranges && ranges.length > 0;
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
                    <input
                      type="time"
                      value={r.start || ''}
                      onChange={e => updateRange(dow, idx, 'start', e.target.value)}
                    />
                    <span className="range-sep">—</span>
                    <input
                      type="time"
                      value={r.end || ''}
                      onChange={e => updateRange(dow, idx, 'end', e.target.value)}
                    />
                    {ranges.length > 1 && (
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => removeRange(dow, idx)}>移除</button>
                    )}
                  </div>
                )) : <span className="schedule-closed">公休</span>}
                {open && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => addRange(dow)}>
                    + 增加時段
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h4 style={{ marginTop: '1.5rem' }}>當日 / 特殊日期調整</h4>
      <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
        可覆蓋該日期的預設時段，例如「當天下午才開放」或「臨時公休」。
      </p>
      <div className="schedule-overrides">
        {overrideKeys.length === 0 && (
          <div className="empty-state" style={{ padding: '0.75rem' }}>尚無特殊日期設定</div>
        )}
        {overrideKeys.map(date => {
          const ov = overrides[date];
          const closed = ov === null || ov === undefined;
          const ranges = Array.isArray(ov) ? ov : [];
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
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setOverrideOpen(date)}>改為開放</button>
                </>
              ) : (
                <div className="schedule-ranges">
                  {ranges.map((r, idx) => (
                    <div key={idx} className="schedule-range">
                      <input
                        type="time"
                        value={r.start || ''}
                        onChange={e => updateOverrideRange(date, idx, 'start', e.target.value)}
                      />
                      <span className="range-sep">—</span>
                      <input
                        type="time"
                        value={r.end || ''}
                        onChange={e => updateOverrideRange(date, idx, 'end', e.target.value)}
                      />
                      {ranges.length > 1 && (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => removeOverrideRange(date, idx)}>移除</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => addOverrideRange(date)}>+ 增加時段</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setOverrideClosed(date)}>改為公休</button>
                </div>
              )}
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeOverride(date)}>刪除</button>
            </div>
          );
        })}
        <button type="button" className="btn btn-sm btn-outline" onClick={addOverride} style={{ marginTop: '0.75rem' }}>
          + 新增特殊日期
        </button>
      </div>

      <h4 style={{ marginTop: '1.5rem' }}>時段參數</h4>
      <div className="form-row">
        <div className="form-group">
          <label>預設預約時長（分鐘）</label>
          <input
            type="number"
            min="15"
            step="15"
            value={settings.defaultBookingDuration ?? 210}
            onChange={e => onChange('defaultBookingDuration', Number(e.target.value))}
          />
          <p className="form-hint">服務項目沒指定時長時套用</p>
        </div>
        <div className="form-group">
          <label>時段間隔（分鐘）</label>
          <input
            type="number"
            min="15"
            step="15"
            value={settings.slotInterval ?? 30}
            onChange={e => onChange('slotInterval', Number(e.target.value))}
          />
          <p className="form-hint">行事曆每隔多少分鐘顯示一個時段起點</p>
        </div>
      </div>
    </div>
  );
}
