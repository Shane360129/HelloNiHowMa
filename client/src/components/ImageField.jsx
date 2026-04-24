import { useId, useRef, useState } from 'react';
import './ImageField.css';

const MAX_DIM = 1600;
const QUALITY = 0.85;

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function resizeToDataUrl(file) {
  const original = await fileToDataUrl(file);
  const img = await loadImage(original);
  let { width, height } = img;
  if (width <= MAX_DIM && height <= MAX_DIM) {
    return original;
  }
  const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', QUALITY);
}

export default function ImageField({ label, value, onChange, hint, required }) {
  const inputRef = useRef(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showUrl, setShowUrl] = useState(false);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('請選擇圖片檔案');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const dataUrl = await resizeToDataUrl(file);
      onChange(dataUrl);
    } catch {
      setError('圖片處理失敗');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="image-field">
      {label && <label className="image-field-label">{label}{required && ' *'}</label>}
      <div className="image-field-row">
        <div className={'image-preview' + (value ? '' : ' image-preview-empty')}>
          {value
            ? <img src={value} alt="" />
            : <span className="image-preview-placeholder">尚未選擇</span>}
        </div>
        <div className="image-field-actions">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            onChange={onPick}
            hidden
          />
          <label htmlFor={inputId} className="btn btn-sm">
            {busy ? '處理中...' : value ? '更換圖片' : '選擇圖片'}
          </label>
          {value && (
            <button type="button" className="btn btn-sm btn-outline" onClick={clear}>清除</button>
          )}
          <button
            type="button"
            className="image-field-link"
            onClick={() => setShowUrl(s => !s)}
          >
            {showUrl ? '收合網址欄' : '改用網址貼入'}
          </button>
        </div>
      </div>
      {showUrl && (
        <input
          type="url"
          className="image-url-input"
          value={value && value.startsWith('data:') ? '' : value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
        />
      )}
      {error && <p className="image-field-error">{error}</p>}
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
}
