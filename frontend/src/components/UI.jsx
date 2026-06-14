import React, { useState, useEffect, useRef } from 'react';
// ui.jsx — shared Dressit UI. Reads theme from CSS vars (--bg, --ink, --accent,
// --line, --radius, --head) so Tweaks stay reactive without prop-drilling.


// ── The signature counter ────────────────────────────────────────────────
// Numeric tween from the previous value to the new one. 'roll' eases down and
// settles; 'tick' races past linearly; 'snap' lands instantly with a pulse.
function Counter({ value, mode = 'roll' }) {
  const [disp, setDisp] = useState(value);
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) { setDisp(to); return; }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 620);

    if (mode === 'snap') {
      setDisp(to);
      return () => { clearTimeout(t); };
    }
    const dur = mode === 'tick' ? 520 : 660;
    const ease = mode === 'tick'
      ? (x) => x                                   // linear blur-past
      : (x) => 1 - Math.pow(1 - x, 3);             // easeOutCubic settle
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const v = Math.round(from + (to - from) * ease(p));
      setDisp(v);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf.current); clearTimeout(t); };
  }, [value, mode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
      <div style={{
        fontVariantNumeric: 'tabular-nums', fontWeight: 500,
        fontSize: 54, letterSpacing: '-0.03em',
        color: flash ? 'var(--accent)' : 'var(--ink)',
        transform: flash ? 'translateY(-1px) scale(1.015)' : 'none',
        transition: 'color .5s ease, transform .45s cubic-bezier(.2,.8,.2,1)',
        fontFeatureSettings: '"tnum" 1',
      }}>{disp.toLocaleString('en-US')}</div>
      <div style={{
        marginTop: 7, fontSize: 12.5, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: 'var(--ink-soft)',
      }}>pieces still on the table</div>
    </div>
  );
}

// ── Quiz option card — richly-styled art placeholder, fully tappable ───────
// (Real product photography is a drop-in slot on the reveal; these abstract
// occasion/fit/palette cards read better as curated editorial placeholders.)
function QuizCard({ option, index, selected, dimmed, onPick, fill }) {
  const hues = [
    'linear-gradient(150deg, #EDE6DA 0%, #E2D8C7 100%)',
    'linear-gradient(150deg, #E6E3DA 0%, #D5D2C4 100%)',
    'linear-gradient(150deg, #E9DFD2 0%, #D8C9B4 100%)',
    'linear-gradient(150deg, #E2E0D6 0%, #CFD0C3 100%)',
  ];
  const hasImg = !!option.image;
  return (
    <button
      onClick={onPick}
      className="dz-qcard"
      style={{
        position: 'relative', border: 'none', padding: 0, cursor: 'pointer',
        borderRadius: 'var(--radius)', overflow: 'hidden', textAlign: 'left',
        background: hues[index % 4], width: '100%',
        aspectRatio: fill ? '4 / 5' : '3 / 4',
        outline: selected ? '2.5px solid var(--accent)' : '1px solid var(--line)',
        outlineOffset: selected ? '2px' : '-1px',
        opacity: dimmed ? 0.32 : 1,
        transform: selected ? 'scale(0.975)' : 'none',
        transition: 'opacity .35s ease, transform .35s cubic-bezier(.2,.8,.2,1), outline-color .2s',
        boxShadow: selected ? '0 8px 24px -10px rgba(40,35,30,0.35)' : 'none',
        fontFamily: 'inherit',
      }}>
      {hasImg ? (
        <img
          className="dz-qcard-img"
          src={option.image}
          alt={option.label}
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 28%' }}
        />
      ) : (
        <>
          {/* diagonal-hatch texture so empty art reads as "image goes here" */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.5,
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 11px)',
          }} />
          {/* ph hint, centered, monospace */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 14,
          }}>
            <span style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 10.5, letterSpacing: '0.04em', color: 'rgba(40,35,30,0.42)',
              textAlign: 'center',
            }}>{option.ph}</span>
          </div>
        </>
      )}
      {/* scrim + label */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '22px 13px 12px',
        background: 'linear-gradient(to top, rgba(38,35,31,0.62), transparent)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{
          fontFamily: 'var(--head)', color: '#FBF9F5', fontSize: 18.5, lineHeight: 1.04,
          letterSpacing: '0.005em', whiteSpace: 'nowrap',
        }}>{option.label}</span>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: selected ? 'none' : '1.5px solid rgba(251,249,245,0.7)',
          background: selected ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .2s', marginBottom: 1,
        }}>
          {selected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="#fff" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>
    </button>
  );
}

// ── Buttons ────────────────────────────────────────────────────────────────
function PrimaryButton({ children, onClick, style = {} }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '100%', border: 'none', cursor: 'pointer',
        background: 'var(--accent)', color: 'var(--accent-ink)',
        fontFamily: 'inherit', fontSize: 16.5, fontWeight: 500, letterSpacing: '0.01em',
        padding: '17px 24px', borderRadius: 9999,
        boxShadow: h ? '0 10px 26px -10px rgba(40,35,30,0.5)' : '0 4px 14px -8px rgba(40,35,30,0.4)',
        transform: h ? 'translateY(-1px)' : 'none',
        transition: 'transform .2s, box-shadow .2s', ...style,
      }}>{children}</button>
  );
}

function GhostButton({ children, onClick, style = {} }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', cursor: 'pointer', background: 'transparent',
      border: '1px solid var(--line)', color: 'var(--ink)',
      fontFamily: 'inherit', fontSize: 15.5, fontWeight: 500,
      padding: '15px 24px', borderRadius: 9999,
      transition: 'background .2s', ...style,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(40,35,30,0.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >{children}</button>
  );
}

// ── Reaction (👍 / 👎), Tinder-style, no text ───────────────────────────────
function Reaction({ value, onChange }) {
  const btn = (kind, glyph) => {
    const active = value === kind;
    return (
      <button onClick={() => onChange(active ? null : kind)} style={{
        width: 46, height: 46, borderRadius: '50%', cursor: 'pointer',
        border: active ? 'none' : '1px solid var(--line)',
        background: active ? (kind === 'up' ? 'var(--accent)' : 'var(--ink)') : 'transparent',
        fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: active ? 'none' : 'grayscale(0.5)', opacity: active ? 1 : 0.7,
        transform: active ? 'scale(1.06)' : 'none',
        transition: 'transform .18s, background .18s, opacity .18s',
      }}>{glyph}</button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {btn('up', '👍')}
      {btn('down', '👎')}
    </div>
  );
}

// ── Profile bar — fashion stat, not an ML readout ───────────────────────────
function ProfileBar({ label, value, delay = 0, play }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!play) { setW(0); return; }
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [play, value, delay]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--head)', fontSize: 22, color: 'var(--ink)' }}>{label}</span>
        <span style={{
          fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 500,
          color: 'var(--ink-soft)',
        }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 9999, background: 'rgba(40,35,30,0.09)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: w + '%', background: 'var(--accent)', borderRadius: 9999,
          transition: 'width 1.05s cubic-bezier(.2,.8,.2,1)',
        }} />
      </div>
    </div>
  );
}

// ── Wordmark ─────────────────────────────────────────────────────────────
function Wordmark({ size = 19 }) {
  return (
    <span style={{
      fontFamily: 'var(--head)', fontSize: size, letterSpacing: '0.01em',
      color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 7,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
      Dressit
    </span>
  );
}



// ── Robust image-slot wrapper ───────────────────────────────────────────────
// The bare custom element collapses under flex pressure and its :host height
// fights aspect-ratio. Wrapping it in an aspect-ratio box (flex-shrink:0) gives
// a definite height the absolutely-filled slot resolves against, in any layout.
function Slot({ id, ph, radius = 14, aspect = '4 / 5', style = {} }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: aspect, flexShrink: 0, ...style }}>
      <image-slot id={id} placeholder={ph} shape="rounded" radius={String(radius)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}></image-slot>
    </div>
  );
}

export { Counter, QuizCard, PrimaryButton, GhostButton, Reaction, ProfileBar, Wordmark, Slot };
