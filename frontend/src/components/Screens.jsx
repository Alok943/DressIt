// screens.jsx — Dressit quiz screens. Responsive, production-ready.
import React, { useState as useS, useEffect as useE } from 'react';
import { Counter, QuizCard, PrimaryButton, GhostButton, Reaction, ProfileBar, Wordmark, Slot } from './UI';

// ── Screen wrapper ────────────────────────────────────────────────────────
function Screen({ children, scroll = false, pad = 0, animKey }) {
  return (
    <div
      key={animKey}
      style={{
        flex: '1 0 auto',
        boxSizing: 'border-box',
        paddingTop: 24,
        paddingBottom: 40,
        paddingLeft: pad,
        paddingRight: pad,
        display: 'flex',
        flexDirection: 'column',
        animation: 'dzFadeIn .35s both',
        ...(scroll ? { overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : {}),
      }}
    >
      {children}
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────
function TopBar({ onBack, label, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, flexShrink: 0, marginBottom: 8 }}>
      <div style={{ minWidth: 80, display: 'flex' }}>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '6px 12px 6px 0',
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              borderRadius: 8, transition: 'background .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(38,35,31,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Back</span>
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{label}</div>
      <div style={{ minWidth: 80, display: 'flex', justifyContent: 'flex-end', fontSize: 13, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>{right}</div>
    </div>
  );
}

// ── Quiz ─────────────────────────────────────────────────────────────────
function Quiz({ q, qIndex, total, count, selected, onPick, onBack }) {
  return (
    <Screen animKey={'q' + q.id}>
      <TopBar onBack={onBack} label={q.kicker} right={(qIndex + 1) + ' / ' + total} />

      <div style={{ marginTop: 12, marginBottom: 6, flexShrink: 0 }}>
        <Counter value={count} mode={window.__dzCounterMode || 'roll'} />
      </div>

      <h2 style={{
        fontFamily: 'var(--head)', fontWeight: 400, margin: '14px 0 18px',
        fontSize: 'clamp(24px, 6vw, 29px)', lineHeight: 1.08, letterSpacing: '-0.005em', color: 'var(--ink)',
        textAlign: 'center', textWrap: 'balance', flexShrink: 0,
      }}>{q.title}</h2>

      <div className="dz-quiz-grid">
        {q.options.map((opt, i) => (
          <QuizCard
            key={opt.key}
            option={opt}
            index={i}
            fill
            selected={selected === opt.key}
            dimmed={selected != null && selected !== opt.key}
            onPick={() => onPick(opt)}
          />
        ))}
      </div>
    </Screen>
  );
}

// ── Fork ────────────────────────────────────────────────────────────────
function Fork({ count, onShow, onMore, onBack }) {
  return (
    <Screen animKey="fork">
      <TopBar onBack={onBack} label="One choice" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, maxWidth: 400, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <Counter value={count} mode={window.__dzCounterMode || 'roll'} />
        </div>
        <h2 style={{
          fontFamily: 'var(--head)', fontWeight: 400, margin: '22px 0 10px',
          fontSize: 'clamp(28px, 7vw, 34px)', lineHeight: 1.04, color: 'var(--ink)', textAlign: 'center', textWrap: 'balance',
        }}>
          Sharper picks,<br />or see them now?
        </h2>
        <p style={{ margin: '0 0 30px', textAlign: 'center', fontSize: 15, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
          Two more taps tightens the picks. Or stop here — your call.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <PrimaryButton onClick={onMore}>2 more questions</PrimaryButton>
          <GhostButton onClick={onShow}>Show my {Math.min(count, 5)} now</GhostButton>
        </div>
      </div>
    </Screen>
  );
}

// ── Product card ────────────────────────────────────────────────────────
function ProductCard({ product, index, reaction, onReact, radius }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', animation: `dzUp .5s ${0.05 * index}s both` }}>
      {product.image ? (
        <a href={product.link} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', aspectRatio: '3/4', flexShrink: 0, borderRadius: radius, overflow: 'hidden' }}>
          <img src={product.image} alt={product.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </a>
      ) : (
        <Slot id={'dz-' + product.id} ph={'product ' + (index + 1)} radius={radius} aspect="3 / 4" />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14, gap: 12 }}>
        <span style={{ fontFamily: 'var(--head)', fontSize: 'clamp(17px, 4vw, 21px)', lineHeight: 1.15, color: 'var(--ink)' }}>{product.name}</span>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginTop: 2 }}>{product.price}</span>
      </div>

      <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginTop: 5 }}>{product.brand}</span>

      <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{product.why}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <Reaction value={reaction} onChange={onReact} />
        {product.link && (
          <a
            href={product.link}
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: 'inherit',
              fontSize: 13, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 5,
              textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--line)',
              textTransform: 'capitalize',
            }}
          >
            View at {product.brand}
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 8L8 3M8 3H4M8 3v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Filter chips (brand / colour) ─────────────────────────────────────────
function FilterChips({ label, options, value, onChange }) {
  if (!options || options.length < 2) return null; // nothing to choose between
  const chip = (key, text) => {
    const active = value === key;
    return (
      <button
        key={key}
        onClick={() => onChange(key)}
        style={{
          flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 13, fontWeight: 500, padding: '7px 14px', borderRadius: 9999,
          border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
          background: active ? 'var(--accent)' : 'transparent',
          color: active ? 'var(--accent-ink)' : 'var(--ink)',
          transition: 'background .15s, border-color .15s, color .15s',
        }}
      >{text}</button>
    );
  };
  return (
    <div className="dz-filterrow">
      <span style={{ fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', flexShrink: 0, alignSelf: 'center', marginRight: 2 }}>{label}</span>
      {chip('all', 'All')}
      {options.map((o) => chip(o.key, o.label))}
    </div>
  );
}

// ── Results ─────────────────────────────────────────────────────────────
function Results({ products, reactions, onReact, headline, verdict, onVerdict, onProfile, onBack, onRefine, refineCount, radius,
  brandOpts = [], colorOpts = [], brandFilter = 'all', colorFilter = 'all', onBrandFilter, onColorFilter,
  filteredTotal, hasMore, onShowMore }) {
  const shown = products.length;                 // currently rendered (grows with "Show more")
  // total survivors the shopper watched the counter land on
  const total = typeof refineCount === 'number' && refineCount >= shown ? refineCount : shown;
  const ft = typeof filteredTotal === 'number' ? filteredTotal : shown; // loadable after filters
  const filtered = brandFilter !== 'all' || colorFilter !== 'all';
  const empty = shown === 0;
  const safeHeadline = empty
    ? (filtered ? 'No matches for this combo.' : 'Nothing matched everything.')
    : filtered
      ? `${ft.toLocaleString('en-US')} ${ft === 1 ? 'piece matches' : 'pieces match'} these filters.`
      : total === 1
        ? 'One piece matches your style.'
        : `${total.toLocaleString('en-US')} pieces match your style.`;
  const sub = empty
    ? (filtered
        ? 'Nothing here for those filters — clear one to widen the net.'
        : 'Your picks were a touch too specific. Tap back and loosen one — colour or fabric usually opens things up.')
    : shown < ft
      ? `Showing ${shown} of ${ft.toLocaleString('en-US')}${filtered ? ' for your filters' : ''} — tap Show more for the rest. A 👍 or 👎 sharpens what comes next.`
      : shown === 1
        ? 'Just one that genuinely fits. A 👍 or 👎 sharpens what comes next.'
        : `Showing all ${shown}${filtered ? ' for your filters' : ''}. A 👍 or 👎 sharpens what comes next.`;
  return (
    <Screen scroll animKey="results">
      <TopBar onBack={onBack} label="your edit" />

      {onRefine && (
        <button
          onClick={onRefine}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7,
            border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer',
            color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500,
            padding: '9px 16px', borderRadius: 9999, marginBottom: 6,
            transition: 'background .15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(38,35,31,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Refine further
        </button>
      )}

      <h1 style={{
        fontFamily: 'var(--head)', fontWeight: 400, margin: '8px 0 0',
        fontSize: 'clamp(30px, 8vw, 40px)', lineHeight: 1.05, letterSpacing: '-0.005em', color: 'var(--ink)', textWrap: 'balance',
      }}>{safeHeadline}</h1>
      <p style={{ margin: '12px 0 22px', fontSize: 15, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
        {sub}
      </p>

      {(brandOpts.length > 1 || colorOpts.length > 1) && (
        <div className="dz-filters">
          <FilterChips label="Brand" options={brandOpts} value={brandFilter} onChange={onBrandFilter} />
          <FilterChips label="Colour" options={colorOpts} value={colorFilter} onChange={onColorFilter} />
        </div>
      )}

      <div className="dz-results-grid">
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            index={i}
            radius={radius}
            reaction={reactions[p.id]}
            onReact={(v) => onReact(p.id, v)}
          />
        ))}
      </div>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30 }}>
          <GhostButton onClick={onShowMore} style={{ maxWidth: 280 }}>Show more</GhostButton>
        </div>
      )}

      {/* Verdict — only when there are picks to judge */}
      {!empty && (
      <div style={{ marginTop: 48, paddingTop: 36, borderTop: '1px solid var(--line)' }}>
        <h3 style={{ fontFamily: 'var(--head)', fontWeight: 400, fontSize: 28, margin: '0 0 18px', color: 'var(--ink)', textAlign: 'center' }}>
          Did we get your style?
        </h3>
        <div style={{ display: 'flex', gap: 11, maxWidth: 320, margin: '0 auto' }}>
          <GhostButton
            onClick={() => onVerdict('yes')}
            style={verdict === 'yes' ? { borderColor: 'var(--accent)', background: 'rgba(90,107,82,0.08)', color: 'var(--accent)' } : {}}
          >
            Yes
          </GhostButton>
          <GhostButton
            onClick={() => onVerdict('no')}
            style={verdict === 'no' ? { borderColor: 'var(--ink)', background: 'rgba(40,35,30,0.05)' } : {}}
          >
            Not really
          </GhostButton>
        </div>
        {verdict && (
          <div style={{ marginTop: 22, animation: 'dzUp .4s both', maxWidth: 320, margin: '22px auto 0' }}>
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 16px' }}>
              {verdict === 'yes' ? "Noted \u2014 we'll keep this lane." : "Fair. We'll widen the net next time."}
            </p>
            <PrimaryButton onClick={onProfile}>See your style profile</PrimaryButton>
          </div>
        )}
      </div>
      )}
    </Screen>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────
function Profile({ profile, onShop, onRestart, onBack }) {
  const [play, setPlay] = useS(false);
  useE(() => { const t = setTimeout(() => setPlay(true), 220); return () => clearTimeout(t); }, []);
  return (
    <Screen animKey="profile">
      <TopBar onBack={onBack} label="The read" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <h1 style={{
          fontFamily: 'var(--head)', fontWeight: 400, margin: '0 0 8px',
          fontSize: 'clamp(36px, 9vw, 44px)', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--ink)',
        }}>Your style</h1>
        <p style={{ margin: '0 0 40px', fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Built from your taps — not a survey you filled out.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          {profile.map((p, i) => (
            <ProfileBar key={p.label} label={p.label} value={p.value} delay={160 + i * 180} play={play} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 48 }}>
          <PrimaryButton onClick={onShop}>Back to your picks</PrimaryButton>
          <GhostButton onClick={onRestart}>Start over</GhostButton>
        </div>
      </div>
    </Screen>
  );
}

export { Screen, Quiz, Fork, Results, Profile, ProductCard };
