import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Quiz, Results, Profile } from './components/Screens';
import { TweaksPanel, TweakSection, TweakSelect, TweakRadio, TweakColor, TweakSlider, useTweaks } from './components/TweaksPanel';
import { QUESTIONS, FORK_AFTER } from './quizConfig.js';
import { survivors, rankPicks, matches } from './filter.js';
import { initAnalytics, track } from './analytics.js';
import { CARD_IMAGES } from './cardImages.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Dynamic card art: show the item the user is actually shopping for, in this card's variation.
// Once "Polos" is chosen, the occasion/fit/colour cards each show a *polo* (casual polo, navy polo…),
// not a generic shirt. Relaxation ladder: gender+category+attribute -> gender+attribute -> attribute.
function widthify(url) {
  if (!url) return url;
  return /[?&]width=/.test(url) ? url : url + (url.includes('?') ? '&' : '?') + 'width=400';
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
      <a href="#" className="dz-navbar-logo" onClick={(e) => { e.preventDefault(); onLogoClick(); }}>
        <span className="dot" />
        Dressit
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

// ── Landing page ─────────────────────────────────────────────────────────
function Landing({ onStart }) {
  return (
    <div className="dz-landing">
      {/* Hero */}
      <section className="dz-hero-section">
        <div className="dz-hero-badge">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          30-second style quiz
        </div>
        <h1 className="dz-hero-title">
          Find clothes you'll actually wear.
        </h1>
        <p className="dz-hero-sub">
          Answer a few quick questions about your style. We'll narrow thousands of products
          down to five picks worth your time — no scrolling, no overwhelm.
        </p>
        <button className="dz-hero-cta" onClick={onStart}>
          Take the quiz
        </button>
      </section>

      {/* How it works */}
      <section className="dz-how" id="how">
        <h2 className="dz-how-title">How it works</h2>
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
            <p>Five hand-picked products with direct links to buy. Rate them to sharpen future picks.</p>
          </div>
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="dz-social">
        <div className="dz-social-stats">
          <div className="dz-social-stat">
            <span>12,000+</span>
            <span>Products indexed</span>
          </div>
          <div className="dz-social-stat">
            <span>30s</span>
            <span>Average quiz time</span>
          </div>
          <div className="dz-social-stat">
            <span>5</span>
            <span>Picks, not 500</span>
          </div>
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
        <span className="dot" />
        Dressit
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
    try {
      const res = await fetch(`${API_BASE}/api/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: resolvedAnswers }),
      });
      if (!res.ok) throw new Error('picks failed');
      const data = await res.json();
      setPicks(data.picks);
    } catch {
      // backend down — fall back to client-side ranking
      if (catalog) {
        const raw = rankPicks(catalog, resolvedAnswers, QUESTIONS, 5);
        setPicks(raw.map((p) => ({
          id: p.link, title: p.title, brand: p.brand,
          price: '₹' + p.price, image: p.image, link: p.link,
          why: 'Hand-picked match based on your preferences.',
        })));
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
    setQi(0);
    setPhase('hero');
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
        <Landing onStart={() => { setQi(0); setPhase('quiz'); }} />
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
    const mappedPicks = (picks || []).map((p) => ({
      id: p.link || p.id,
      name: p.title || p.name,
      price: p.price,
      brand: p.brand,
      why: p.why || 'Hand-picked match based on your preferences.',
      image: p.image,
      link: p.link,
    }));
    content = (
      <div className="dz-quiz-shell" style={{ maxWidth: 700 }}>
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
    <div style={{ ...theme, minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
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
