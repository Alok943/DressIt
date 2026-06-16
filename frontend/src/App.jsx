import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Quiz, Results, Profile } from './components/Screens';
import { TweaksPanel, TweakSection, TweakSelect, TweakRadio, TweakColor, TweakSlider, useTweaks } from './components/TweaksPanel';
import { QUESTIONS, FORK_AFTER, COLOR_BUCKETS } from './quizConfig.js';
import { survivors, rankPicks, matches } from './filter.js';
import { initAnalytics, track } from './analytics.js';
import { CARD_IMAGES } from './cardImages.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Upper bound on the ranked set we hold (not what's rendered — the grid reveals a
// batch at a time via "Show more"). Keep in sync with MAX_PICKS in
// backend/app/routes/picks.py.
const MAX_PICKS = 300;
const RESULTS_BATCH = 24; // cards revealed per "Show more" / initial render

// Display names for the brand filter chips (catalog stores lowercase keys).
const BRAND_LABELS = {
  snitch: 'Snitch', bearhouse: 'Bear House', bonkers: 'Bonkers',
  powerlook: 'Powerlook', vastrado: 'Vastrado', offduty: 'Offduty',
};
const brandLabel = (b) => BRAND_LABELS[b] || (b ? b[0].toUpperCase() + b.slice(1) : b);

// Dynamic card art: show the item the user is actually shopping for, in this card's variation.
// Once "Polos" is chosen, the occasion/fit/colour cards each show a *polo* (casual polo, navy polo…),
// not a generic shirt. Relaxation ladder: gender+category+attribute -> gender+attribute -> attribute.
function widthify(url, w = 400) {
  if (!url) return url;
  return /[?&]width=/.test(url) ? url : url + (url.includes('?') ? '&' : '?') + 'width=' + w;
}

// Warm the browser cache for image URLs so they don't pop in when rendered.
// De-duped across the session so we never re-request the same URL.
const _preloaded = new Set();
function preloadImages(urls) {
  for (const u of urls) {
    if (!u || _preloaded.has(u)) continue;
    _preloaded.add(u);
    const img = new Image();
    img.src = u;
  }
}
function cardImageFor(catalog, answers, q, card, used) {
  if (!catalog || !card.values || card.values.length === 0) return null; // skip/“no preference” cards
  const gv = q.id !== 'gender' && answers.gender ? answers.gender.values : null;
  const cv = q.dim !== 'category' && answers.category ? answers.category.values : null;
  const self = (p) => matches(p, q.dim, card.values);
  const inCat = (p) => !cv || matches(p, 'category', cv);
  // Category is sacred: once the user picks "T-shirts", every downstream card must show a
  // t-shirt. We relax the ATTRIBUTE (and gender) before ever dropping the category — so a
  // casual-tshirt card falls back to any tshirt, never to a casual polo.
  const ladder = [
    (p) => inCat(p) && self(p) && (!gv || matches(p, 'gender', gv)), // ideal: cat + attr + gender
    (p) => inCat(p) && self(p),                                      // cat + attr (any gender)
    (p) => inCat(p) && (!gv || matches(p, 'gender', gv)),            // cat + gender (attr relaxed)
    (p) => inCat(p),                                                 // any product of the category
  ];
  // pass 1: prefer an image not already used on this screen, so cards stay distinct
  for (const cond of ladder) {
    const m = catalog.find((p) => p.image && !used.has(p.image) && cond(p));
    if (m) { used.add(m.image); return widthify(m.image); }
  }
  // pass 2: allow reuse rather than show nothing
  for (const cond of ladder) {
    const m = catalog.find((p) => p.image && cond(p));
    if (m) return widthify(m.image);
  }
  return null;
}

// ── Design tokens ────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = {
  headingFont: 'Instrument Serif',
  counter: 'roll',
  accent: '#5A6B52',
  bg: '#FAF8F5',
  cardRadius: 14,
  resultsCopy: 'We found 5 worth your time.',
};
const ACCENT_INK = {
  '#5A6B52': '#FBF9F5',
  '#C9B79C': '#2A2620',
  '#26231F': '#FBF9F5',
  '#A8553A': '#FBF9F5',
};

// ── Navbar ────────────────────────────────────────────────────────────────
function Navbar({ phase, onLogoClick }) {
  return (
    <nav className="dz-navbar">
      <a href="#" className="dz-navbar-logo" onClick={(e) => { e.preventDefault(); onLogoClick(); }} aria-label="Dressit — home">
        <img src="/dressit-wordmark.png" alt="Dressit" className="dz-logo-img" />
      </a>
      <div className="dz-navbar-nav">
        {phase === 'hero' && (
          <>
            <a href="#how" className="dz-navbar-link" style={{ display: 'none' }}>How it works</a>
            <button className="dz-navbar-cta" onClick={onLogoClick} style={{ display: 'none' }}>
              Start quiz
            </button>
          </>
        )}
        {phase !== 'hero' && (
          <button
            className="dz-navbar-link"
            onClick={onLogoClick}
            style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
          >
            Start over
          </button>
        )}
      </div>
    </nav>
  );
}

// Pick a spread of real catalog photos for the landing — varied across categories
// so the hero/lookbook reads like a curated editorial, not one rack. Shuffled per
// visit for freshness. Returns [] until the catalog loads (callers fall back to tiles).
function pickShowcase(catalog, n) {
  if (!catalog) return [];
  const byCat = {};
  for (const p of catalog) {
    if (!p.image) continue;
    const c = (Array.isArray(p.category) ? p.category[0] : p.category) || 'misc';
    (byCat[c] ||= []).push(p.image);
  }
  for (const arr of Object.values(byCat)) {        // shuffle within each category
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const cats = Object.keys(byCat).sort(() => Math.random() - 0.5);
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 4) {       // round-robin across categories
    for (const c of cats) {
      const img = byCat[c].pop();
      if (img) out.push(img);
      if (out.length >= n) break;
    }
    if (cats.every((c) => byCat[c].length === 0)) break;
  }
  // NB: pass an explicit width — bare `out.map(widthify)` would feed the array
  // index as the width arg, producing width=0,1,2… (invisible Shopify images).
  return out.map((u) => widthify(u, 500));
}

// Free-text search → quiz answers. Maps a phrase like "black oversized tee for work"
// onto the canonical quiz cards (gender, category, fit, colour, pattern, occasion…) so
// the shopper can skip straight past the questions they've already decided. Returns an
// `answers` object keyed by question id; unmatched dims stay unanswered (asked in-quiz).
const SEARCH_SYNONYMS = {
  tee: 'tshirt', tees: 'tshirt', 't-shirt': 'tshirt', 't-shirts': 'tshirt', tshirts: 'tshirt',
  pant: 'trousers', pants: 'trousers', chino: 'trousers', chinos: 'trousers', trouser: 'trousers',
  jean: 'jeans', denim: 'jeans', hoody: 'hoodie', hoodies: 'hoodie',
  loose: 'oversized', oversize: 'oversized', baggy: 'baggy', relaxed: 'relaxed',
  fitted: 'slim', slimfit: 'slim', skinny: 'skinny',
  formals: 'formal', partywear: 'party', office: 'work', officewear: 'work',
  plaid: 'check', checked: 'check', striped: 'stripe', printed: 'print', graphics: 'graphic',
};
function parseSearchQuery(query) {
  const q = ' ' + query.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, ' ') + ' ';
  const answers = {};

  // gender — word-boundary regex so "men" doesn't fire inside "women"
  const womenCat = /\b(dress|dresses|skirt|gown|saree|kurti|co-?ord)\b/.test(q);
  const isWomen = womenCat || /\b(women|womens|woman|girl|girls|ladies|female|her)\b/.test(q);
  const isMen = /\b(men|mens|man|boy|boys|male|guy|guys|his)\b/.test(q);
  const gender = isWomen ? 'women' : (isMen ? 'men' : 'men'); // catalog is ~98% men → default men
  const gCard = QUESTIONS[0].cards.find((c) => c.values.includes(gender));
  if (gCard) answers.gender = { label: gCard.label, values: gCard.values };

  // remaining dims: score each card by how much of the query its values/label/synonyms hit
  const visible = QUESTIONS.filter((qq) => !qq.showIf || qq.showIf(answers));
  for (const qq of visible) {
    if (qq.id === 'gender' || answers[qq.id]) continue;
    let best = null, score = 0;
    for (const card of qq.cards) {
      if (!card.values || !card.values.length) continue;
      let s = 0;
      for (const v of card.values) {
        if (q.includes(' ' + v + ' ') || q.includes(v.replace(/_/g, ' '))) s += 3;
      }
      for (const w of card.label.toLowerCase().split(/[^a-z]+/)) {
        if (w.length > 2 && q.includes(w)) s += 1;
      }
      for (const [syn, canon] of Object.entries(SEARCH_SYNONYMS)) {
        if (q.includes(' ' + syn) && card.values.includes(canon)) s += 3;
      }
      if (s > score) { score = s; best = card; }
    }
    if (best) answers[qq.id] = { label: best.label, values: best.values };
  }
  return answers;
}

// ── Landing page ─────────────────────────────────────────────────────────
const SHOWCASE_BRANDS = [
  { key: 'snitch', name: 'Snitch', logo: '/logos/snitch.webp' },
  { key: 'bearhouse', name: 'Bear House', logo: '/logos/bearhouse.svg' },
  { key: 'bonkers', name: 'Bonkers Corner', logo: '/logos/bonkers.webp' },
  { key: 'powerlook', name: 'Powerlook', logo: '/logos/powerlook.avif' },
  { key: 'vastrado', name: 'Vastrado', logo: '/logos/vastrado.avif' },
  { key: 'offduty', name: 'Offduty', logo: '/logos/offduty.avif' },
];

// Average luminance of a logo's opaque pixels — used to pick its chip backdrop.
function logoLuminance(img) {
  const c = document.createElement('canvas');
  const w = (c.width = 64), h = (c.height = 28);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let lum = 0, a = 0;
  for (let i = 0; i < d.length; i += 4) {
    const al = d[i + 3] / 255;
    if (al < 0.12) continue; // ignore transparent pixels
    lum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * al;
    a += al;
  }
  return a ? lum / a : 0;
}

// Brand logo on an adaptive chip. Source marks are mixed (Snitch black, Bonkers
// white, Offduty yellow) so no single backdrop shows them all in true colour —
// `tone` (measured once per brand by the parent) puts light/white marks on a dark
// chip and dark marks on a light chip. Hidden until measured to avoid a flash.
function BrandLogo({ src, name, tone }) {
  return (
    <span className={'dz-brand-chip' + (tone === 'light' ? ' dz-brand-chip--dark' : '')}>
      <img
        className="dz-brand-logo" src={src} alt={name} title={name}
        style={{ opacity: tone ? 1 : 0, transition: 'opacity .25s ease' }}
      />
    </span>
  );
}

function Landing({ onStart, onSearch, catalog }) {
  const [query, setQuery] = useState('');
  const [tones, setTones] = useState({}); // brand key -> 'light' | 'dark' (the logo's tone)
  const showcase = useMemo(() => pickShowcase(catalog, 18), [catalog]);
  const collage = showcase.slice(0, 4);
  const marquee = showcase.slice(4, 18);

  // measure each brand logo's luminance once (not per marquee copy) so every
  // instance gets the right chip — a light/white mark on a dark chip, etc.
  useEffect(() => {
    let alive = true;
    SHOWCASE_BRANDS.forEach((b) => {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        let tone = 'dark';
        try { tone = logoLuminance(img) > 135 ? 'light' : 'dark'; } catch { /* keep default */ }
        setTones((t) => (t[b.key] ? t : { ...t, [b.key]: tone }));
      };
      img.src = b.logo;
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="dz-landing">
      {/* Hero — editorial split: copy + a staggered collage of real pieces */}
      <section className="dz-hero">
        <div className="dz-hero-copy">
          <div className="dz-hero-badge">
            <span className="dz-pulse" />
            30-second style quiz
          </div>
          <h1 className="dz-hero-title">
            Find clothes you'll <em>actually</em> wear.
          </h1>
          <p className="dz-hero-sub">
            Skip the endless filters. Tap through a quick visual quiz and we'll narrow
            thousands of pieces down to five worth your time.
          </p>
          <button className="dz-hero-cta" onClick={onStart}>
            Take the quiz
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <path d="M3 8.5h11M9.5 4l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="dz-or"><span>or already know what you want?</span></div>

          <form
            className="dz-search"
            onSubmit={(e) => { e.preventDefault(); onSearch(query); }}
          >
            <svg className="dz-search-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="black oversized tee, linen shirt for work…"
              aria-label="Search what you want"
            />
            <button type="submit" className="dz-search-go" aria-label="Search">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <path d="M3 8.5h11M9.5 4l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          <p className="dz-hero-trust">We'll pre-fill the quiz and pick up from there.</p>
        </div>

        <div className="dz-hero-collage" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div className={`dz-collage-tile dz-collage-tile--${i}`} key={i}>
              {collage[i]
                ? <img src={collage[i]} alt="" loading={i < 2 ? 'eager' : 'lazy'} />
                : <div className="dz-collage-ph" />}
            </div>
          ))}
        </div>
      </section>

      {/* Lookbook marquee — proof there's a real, deep catalog behind the quiz */}
      <section className="dz-marquee" aria-hidden="true">
        <div className="dz-marquee-track">
          {[...marquee, ...marquee].map((src, i) => (
            <div className="dz-marquee-item" key={i}>
              {src ? <img src={src} alt="" loading="lazy" /> : <div className="dz-collage-ph" />}
            </div>
          ))}
        </div>
      </section>

      {/* Brands — the labels stocked behind the quiz */}
      <section className="dz-brands">
        <span className="dz-brands-label">Curated from India's best D2C labels</span>
        <div className="dz-brands-marquee">
          {/* repeated 4× so one half of the track always exceeds the viewport and
              translateX(-50%) loops with no gap */}
          <div className="dz-brands-track">
            {[...SHOWCASE_BRANDS, ...SHOWCASE_BRANDS, ...SHOWCASE_BRANDS, ...SHOWCASE_BRANDS].map((b, i) => (
              <BrandLogo key={b.key + '-' + i} src={b.logo} name={b.name} tone={tones[b.key]} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="dz-how" id="how">
        <span className="dz-how-eyebrow">How it works</span>
        <h2 className="dz-how-title">Three taps from overwhelmed to outfitted.</h2>
        <div className="dz-how-grid">
          <div className="dz-how-step" style={{ animation: 'dzUp .5s 0.1s both' }}>
            <div className="dz-how-num">1</div>
            <h3>Tap your vibe</h3>
            <p>Occasion, fit, palette, budget — quick visual taps, no typing. Takes about 30 seconds.</p>
          </div>
          <div className="dz-how-step" style={{ animation: 'dzUp .5s 0.2s both' }}>
            <div className="dz-how-num">2</div>
            <h3>Watch it narrow</h3>
            <p>A live counter shows the catalog shrinking in real time as your preferences cut through the noise.</p>
          </div>
          <div className="dz-how-step" style={{ animation: 'dzUp .5s 0.3s both' }}>
            <div className="dz-how-num">3</div>
            <h3>Get your 5</h3>
            <p>Five hand-picked pieces with direct links to buy. Rate them to sharpen future picks.</p>
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="dz-closing">
        <h2 className="dz-closing-title">Your edit is five taps away.</h2>
        <button className="dz-hero-cta" onClick={onStart}>
          Start the quiz
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M3 8.5h11M9.5 4l4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="dz-social-stats">
          <div className="dz-social-stat"><span>11,000+</span><span>Pieces indexed</span></div>
          <div className="dz-social-stat"><span>30s</span><span>To your picks</span></div>
          <div className="dz-social-stat"><span>5</span><span>Not 500</span></div>
        </div>
      </section>
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="dz-footer">
      <div className="dz-footer-logo">
        <img src="/dressit-wordmark.png" alt="Dressit" className="dz-logo-img dz-logo-img--footer" />
      </div>
      <div className="dz-footer-links">
        <a href="#">About</a>
        <a href="#">Privacy</a>
        <a href="#">Contact</a>
      </div>
      <div className="dz-footer-copy">
        &copy; {new Date().getFullYear()} Dressit. All rights reserved.
      </div>
    </footer>
  );
}

// ── App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  window.__dzCounterMode = t.counter;

  const [catalog, setCatalog] = useState(null);
  const [phase, setPhase] = useState('hero');
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState({});
  const [reactions, setReactions] = useState({});
  const [verdict, setVerdict] = useState(null);
  const [picks, setPicks] = useState(null);
  const [picksLoading, setPicksLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(RESULTS_BATCH);
  const locked = useRef(false);
  const sessionId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    initAnalytics();
    fetch('/catalog.json').then((r) => r.json()).then(setCatalog);
    track('quiz_start', {});
  }, []);

  const fetchPicks = useCallback(async (resolvedAnswers) => {
    setPicksLoading(true);
    setPicks(null);
    setBrandFilter('all');
    setColorFilter('all');
    setVisibleCount(RESULTS_BATCH);
    try {
      // bail fast if the backend is asleep (Render free tier cold-starts ~30s) —
      // the client-side ranking below is identical, so don't make the user wait
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${API_BASE}/api/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: resolvedAnswers }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('picks failed');
      const data = await res.json();
      preloadImages((data.picks || []).slice(0, RESULTS_BATCH).map((p) => widthify(p.image, 600)));
      setPicks(data.picks);
    } catch {
      // backend down/slow — fall back to client-side ranking (same logic)
      if (catalog) {
        const raw = rankPicks(catalog, resolvedAnswers, QUESTIONS, MAX_PICKS);
        const mapped = raw.map((p) => ({
          id: p.link, title: p.title, brand: p.brand,
          price: '₹' + p.price, image: p.image, link: p.link,
          why: 'Hand-picked match based on your preferences.',
        }));
        preloadImages(mapped.slice(0, RESULTS_BATCH).map((p) => widthify(p.image, 600)));
        setPicks(mapped);
      }
    } finally {
      setPicksLoading(false);
    }
  }, [catalog]);

  async function postReaction(productLink, reaction) {
    try {
      await fetch(`${API_BASE}/api/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_link: productLink,
          reaction,
          session_id: sessionId.current,
          answers,
        }),
      });
    } catch { /* fire-and-forget, non-critical */ }
  }

  const visibleQs = useMemo(
    () => QUESTIONS.filter((q) => !q.showIf || q.showIf(answers)),
    [answers],
  );

  // link -> catalog product, for reading a pick's colour in the results filter
  const catByLink = useMemo(() => {
    const m = {};
    if (catalog) for (const p of catalog) m[p.link] = p;
    return m;
  }, [catalog]);

  const theme = {
    '--bg': t.bg,
    '--ink': '#26231F',
    '--ink-soft': 'rgba(38,35,31,0.56)',
    '--line': 'rgba(38,35,31,0.14)',
    '--accent': t.accent,
    '--accent-ink': ACCENT_INK[t.accent] || '#FBF9F5',
    '--radius': t.cardRadius + 'px',
    '--head': '"' + t.headingFont + '", Georgia, serif',
  };

  const count = catalog ? survivors(catalog, answers, QUESTIONS).length : 0;

  function pick(opt) {
    if (locked.current) return;
    locked.current = true;
    const q = visibleQs[qi];
    const nextAnswers = { ...answers, [q.id]: { label: opt.label, values: opt.values } };
    setAnswers(nextAnswers);
    // preload the next screen's card art (and, near the fork, the result images)
    // so nothing pops in during the transition
    const nextVisible = QUESTIONS.filter((vq) => !vq.showIf || vq.showIf(nextAnswers));
    const nq = nextVisible[qi + 1];
    if (nq && !nq.soft && catalog) {
      const used = new Set();
      preloadImages((nq.cards || []).map((c) => cardImageFor(catalog, nextAnswers, nq, c, used)).filter(Boolean));
    }
    if ((qi === FORK_AFTER - 1 || qi >= visibleQs.length - 1) && catalog) {
      preloadImages(rankPicks(catalog, nextAnswers, QUESTIONS, 12).map((p) => widthify(p.image, 600)));
    }
    setTimeout(() => {
      const isLast = qi >= visibleQs.length - 1;
      // After the core questions (FORK_AFTER), show results immediately. Remaining
      // questions stay reachable via the "Refine further" button on the results page.
      if ((qi === FORK_AFTER - 1 && !isLast) || isLast) {
        fetchPicks(nextAnswers);
        setPhase('results');
      } else {
        setQi(qi + 1);
      }
      locked.current = false;
    }, 780);
  }

  function back() {
    if (phase === 'quiz') {
      if (qi === 0) { setPhase('hero'); return; }
      const prevQ = visibleQs[qi - 1];
      const nextAnswers = { ...answers };
      delete nextAnswers[prevQ.id];
      setAnswers(nextAnswers);
      setQi(qi - 1);
    }
  }

  function restart() {
    setAnswers({});
    setReactions({});
    setVerdict(null);
    setBrandFilter('all');
    setColorFilter('all');
    setQi(0);
    setPhase('hero');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Search entry: parse the phrase into answers, then drop the user at the first
  // question they HAVEN'T answered. If the search already covered the core dims
  // (everything up to the fork), skip straight to results.
  function startFromSearch(rawQuery) {
    setReactions({});
    setVerdict(null);
    const query = (rawQuery || '').trim();
    if (!query) { setQi(0); setPhase('quiz'); return; }
    const parsed = parseSearchQuery(query);
    const nextVisible = QUESTIONS.filter((vq) => !vq.showIf || vq.showIf(parsed));
    const firstUnanswered = nextVisible.findIndex((vq) => !parsed[vq.id]);
    setAnswers(parsed);
    track('quiz_search', { query, matched: Object.keys(parsed) });
    if (firstUnanswered === -1 || firstUnanswered >= FORK_AFTER) {
      fetchPicks(parsed);
      setPhase('results');
    } else {
      setQi(firstUnanswered);
      setPhase('quiz');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Map quizConfig question to the shape Screens.Quiz expects.
  // Card art is computed from the answers so far, so it shows the chosen item's variations.
  const q = visibleQs[qi];
  const mappedQ = useMemo(() => {
    if (!q) return null;

    // Dead-end removal: drop any HARD option that would leave 0 survivors given the
    // answers so far — a user can never tap into the "nothing matched" wall. Soft dims
    // (color/sleeve/fabric) only affect ranking, never cut the count, so they're never
    // dropped; "no preference" (empty values) cards are always kept.
    let cards = q.cards;
    if (catalog && !q.soft) {
      const viable = q.cards.filter((c) => {
        if (!c.values || c.values.length === 0) return true; // skip / no-preference
        const hypo = { ...answers, [q.id]: { label: c.label, values: c.values } };
        return survivors(catalog, hypo, QUESTIONS).length > 0;
      });
      if (viable.length > 0) cards = viable; // never blank the screen — fall back to all
    }

    const used = new Set(); // keep each card's photo distinct within this screen
    return {
      id: q.id,
      kicker: q.dim || 'Question',
      title: q.prompt,
      options: cards.map((c) => ({
        key: c.label,
        label: c.label,
        subtitle: c.subtitle,
        ph: c.emoji,
        image: cardImageFor(catalog, answers, q, c, used) || (CARD_IMAGES[q.id] || {})[c.label] || null,
        values: c.values,
      })),
    };
  }, [q, answers, catalog]);

  // ── Screen router ──────────────────────────────────────────────────────
  let content;
  if (phase === 'hero') {
    content = (
      <>
        <Landing catalog={catalog} onStart={() => { setQi(0); setPhase('quiz'); }} onSearch={startFromSearch} />
        <Footer />
      </>
    );
  } else if (!catalog) {
    content = (
      <div className="dz-quiz-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 16, animation: 'dzFadeIn .4s both' }}>
          <div style={{ fontFamily: 'var(--head)', fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>Loading the racks…</div>
          <p>Hang tight, we're pulling the catalog.</p>
        </div>
      </div>
    );
  } else if (phase === 'quiz') {
    // fixed-height shell on mobile so all cards fit the viewport (no scroll); footer
    // dropped mid-quiz to reclaim vertical space.
    content = (
      <div className="dz-quiz-shell dz-quiz-shell--fixed">
        <Quiz
          q={mappedQ}
          qIndex={qi}
          total={visibleQs.length}
          count={count}
          selected={answers[q.id] ? answers[q.id].label : null}
          onPick={pick}
          onBack={back}
        />
      </div>
    );
  } else if (phase === 'results') {
    // remaining (post-core) questions still unanswered → offer "Refine further"
    const nextUnanswered = visibleQs.findIndex((vq) => !answers[vq.id]);
    const canRefine = nextUnanswered !== -1;

    // colour lookup per pick (picks don't carry colour; read it from the catalog)
    const colorOf = (p) => {
      const cp = catByLink[p.link || p.id];
      const c = cp ? cp.color : [];
      return Array.isArray(c) ? c : (c ? [c] : []);
    };
    const inBucket = (p, bucket) => colorOf(p).some((c) => (COLOR_BUCKETS[bucket] || []).includes(c));

    const allPicks = picks || [];
    // which brands / colour buckets are actually present in this result set
    const brandOpts = [...new Set(allPicks.map((p) => p.brand))]
      .map((b) => ({ key: b, label: brandLabel(b) }));
    const colorOpts = Object.keys(COLOR_BUCKETS)
      .filter((bucket) => allPicks.some((p) => inBucket(p, bucket)))
      .map((bucket) => ({ key: bucket, label: bucket[0].toUpperCase() + bucket.slice(1) }));

    const filtered = allPicks.filter((p) =>
      (brandFilter === 'all' || p.brand === brandFilter) &&
      (colorFilter === 'all' || inBucket(p, colorFilter)),
    );
    const mappedAll = filtered.map((p) => ({
      id: p.link || p.id,
      name: p.title || p.name,
      price: p.price,
      brand: p.brand,
      why: p.why || 'Hand-picked match based on your preferences.',
      image: widthify(p.image, 600),
      link: p.link,
    }));
    // progressive reveal: only render `visibleCount` cards; "Show more" reveals the
    // next batch and we preload that batch's images in the background first
    const mappedPicks = mappedAll.slice(0, visibleCount);
    const hasMore = mappedAll.length > visibleCount;
    const showMore = () => {
      preloadImages(mappedAll.slice(visibleCount, visibleCount + RESULTS_BATCH).map((p) => p.image));
      setVisibleCount((c) => c + RESULTS_BATCH);
    };
    const resetCount = () => setVisibleCount(RESULTS_BATCH);
    content = (
      <div className="dz-quiz-shell" style={{ maxWidth: 980 }}>
        {picksLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink-soft)', animation: 'dzFadeIn .3s both' }}>
            <div style={{ fontFamily: 'var(--head)', fontSize: 22, color: 'var(--ink)' }}>Curating your picks\u2026</div>
            <p style={{ fontSize: 14 }}>Matching {count.toLocaleString('en-US')} survivors to your style.</p>
          </div>
        ) : (
          <Results
            products={mappedPicks}
            reactions={reactions}
            onReact={(id, v) => {
              const next = { ...reactions, [id]: v };
              setReactions(next);
              if (v) postReaction(id, v);
              track('product_react', { product_id: id, reaction: v });
            }}
            headline={t.resultsCopy}
            verdict={verdict}
            onVerdict={setVerdict}
            onProfile={() => setPhase('profile')}
            onBack={() => { setPhase('quiz'); setQi(visibleQs.length - 1); }}
            onRefine={canRefine ? () => { setQi(nextUnanswered); setPhase('quiz'); } : null}
            refineCount={count}
            radius={t.cardRadius}
            brandOpts={brandOpts}
            colorOpts={colorOpts}
            brandFilter={brandFilter}
            colorFilter={colorFilter}
            onBrandFilter={(v) => { setBrandFilter(v); resetCount(); }}
            onColorFilter={(v) => { setColorFilter(v); resetCount(); }}
            filteredTotal={mappedAll.length}
            hasMore={hasMore}
            onShowMore={showMore}
          />
        )}
        <Footer />
      </div>
    );
  } else {
    const profileData = Object.entries(answers)
      .slice(0, 3)
      .map(([, v]) => ({ label: v.label, value: 85 }));
    content = (
      <div className="dz-quiz-shell">
        <Profile
          profile={profileData}
          onShop={() => setPhase('results')}
          onRestart={restart}
          onBack={() => setPhase('results')}
        />
        <Footer />
      </div>
    );
  }

  return (
    <div className="dz-app" style={{ ...theme, minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Navbar phase={phase} onLogoClick={restart} />
      {content}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Type" />
        <TweakSelect
          label="Heading font"
          value={t.headingFont}
          options={['Instrument Serif', 'Cormorant Garamond']}
          onChange={(v) => setTweak('headingFont', v)}
        />
        <TweakSection label="The counter" />
        <TweakRadio
          label="Behaviour"
          value={t.counter}
          options={['roll', 'tick', 'snap']}
          onChange={(v) => setTweak('counter', v)}
        />
        <TweakSection label="Look" />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={['#5A6B52', '#C9B79C', '#26231F', '#A8553A']}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakColor
          label="Background"
          value={t.bg}
          options={['#FAF8F5', '#F3EEE6', '#FCFBF9']}
          onChange={(v) => setTweak('bg', v)}
        />
        <TweakSlider
          label="Corner radius"
          value={t.cardRadius}
          min={0}
          max={26}
          unit="px"
          onChange={(v) => setTweak('cardRadius', v)}
        />
        <TweakSection label="Copy" />
        <TweakSelect
          label="Results headline"
          value={t.resultsCopy}
          options={[
            'We found 5 worth your time.',
            "Here\u2019s what survived.",
            'Your 5. Hand-picked.',
          ]}
          onChange={(v) => setTweak('resultsCopy', v)}
        />
      </TweaksPanel>
    </div>
  );
}
