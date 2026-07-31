import { useState, useCallback } from 'react';
import { Icon } from './primitives.jsx';

const PRESETS = [
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
  { label: 'Bulan ini', getRange: () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISODate(from), to: toISODate(now) };
  }},
  { label: 'Bulan lalu', getRange: () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toISODate(from), to: toISODate(to) };
  }},
];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function defaultRange() {
  return { from: daysAgo(30), to: toISODate(new Date()) };
}

function matchesPreset(from, to) {
  if (!from || !to) return null;
  for (const p of PRESETS) {
    if (p.getRange) {
      const r = p.getRange();
      if (r.from === from && r.to === to) return p.label;
    } else if (from === daysAgo(p.days) && to === toISODate(new Date())) {
      return p.label;
    }
  }
  return null;
}

/**
 * DateRangePicker — kontrol tanggal dengan preset cepat.
 *
 * Props:
 *   value: { from: string, to: string }  (format YYYY-MM-DD)
 *   onChange: ({ from, to }) => void
 *   presets: boolean (tampilkan preset, default true)
 */
export default function DateRangePicker({ value, onChange, presets = true }) {
  const range = value ?? defaultRange();
  const fromStr = range.from ?? '';
  const toStr = range.to ?? '';
  const activePreset = matchesPreset(fromStr, toStr);

  const handlePreset = useCallback((preset) => {
    if (preset.getRange) {
      onChange?.(preset.getRange());
    } else {
      onChange?.({ from: daysAgo(preset.days), to: toISODate(new Date()) });
    }
  }, [onChange]);

  return (
    <div className="drp">
      <div className="drp-inputs">
        <label className="drp-field">
          <span className="drp-label">Dari</span>
          <input
            type="date"
            className="input drp-date"
            value={fromStr}
            max={toStr || undefined}
            onChange={(e) => onChange?.({ from: e.target.value, to: toStr })}
            aria-label="Tanggal awal"
          />
        </label>
        <Icon name="arrow_forward" size={14} style={{ color: 'var(--ink-3)', marginTop: 18 }} />
        <label className="drp-field">
          <span className="drp-label">Sampai</span>
          <input
            type="date"
            className="input drp-date"
            value={toStr}
            min={fromStr || undefined}
            max={toISODate(new Date())}
            onChange={(e) => onChange?.({ from: fromStr, to: e.target.value })}
            aria-label="Tanggal akhir"
          />
        </label>
      </div>
      {presets && (
        <div className="drp-presets">
          {PRESETS.map((p) => {
            const isActive = activePreset === p.label;
            return (
              <button
                key={p.label}
                className={`drp-preset${isActive ? ' active' : ''}`}
                onClick={() => handlePreset(p)}
                aria-pressed={isActive}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
