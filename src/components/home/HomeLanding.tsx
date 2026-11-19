import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRight, Check, Code2, Layers, Network, Activity, Gauge, Database, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { links } from '../../app/route';
import './home-landing.css';
import './home-landing-enhance.css';
import './home-landing-header.css';
import MacroToMicroJourney from './MacroToMicroJourney';
import { useAuthStore } from '../../features/auth/authStore';

type Language = 'java' | 'cpp' | 'python';
type LoadState = 'normal' | 'high' | 'overload';

/* TEMP: set to false (or delete the block in the header) to remove the Admin link. */
const SHOW_ADMIN_LINK = true;

/* Traffic cycle: purely state based, no numbers are shown to the user. */
const CYCLE: LoadState[] = ['normal', 'high', 'overload', 'high'];
const CYCLE_MS = 3600;
const STATE_ORDER: LoadState[] = ['normal', 'high', 'overload'];
const METER_SEGMENTS = 28;
const BAR_COUNT = 12;

const CONFIG: Record<LoadState, {
  pill: string; status: string; limiter: string; chip: string;
  packets: number; accepted: number; dropped: number; speed: number;
  tokens: number; meter: number; rejectBars: number;
}> = {
  normal:   { pill: 'Normal',     status: 'Normal traffic',                limiter: 'Standby',    chip: 'allow path',      packets: 2, accepted: 2, dropped: 0, speed: 2.4, tokens: 5, meter: 8,  rejectBars: 0 },
  high:     { pill: 'High load',  status: 'High load · rate limiting',     limiter: 'Protecting', chip: 'checking tokens', packets: 4, accepted: 3, dropped: 2, speed: 1.5, tokens: 3, meter: 18, rejectBars: 4 },
  overload: { pill: 'Overloaded', status: 'Overloaded · requests rejected', limiter: 'Overloaded', chip: 'reject path',     packets: 6, accepted: 3, dropped: 6, speed: 0.9, tokens: 1, meter: 28, rejectBars: 11 },
};

const codeSamples: Record<Language, { file: string; lines: string[]; guard: number; allow: number; reject: number }> = {
  java: {
    file: 'token-bucket.java',
    lines: ['boolean allowRequest(int tokens) {', '  if (available >= tokens) {', '    available -= tokens;', '    return true;', '  }', '  return false;', '}'],
    guard: 1, allow: 3, reject: 5,
  },
  cpp: {
    file: 'token-bucket.cpp',
    lines: ['bool allowRequest(int tokens) {', '  if (available >= tokens) {', '    available -= tokens;', '    return true;', '  }', '  return false;', '}'],
    guard: 1, allow: 3, reject: 5,
  },
  python: {
    file: 'token-bucket.py',
    lines: ['def allow_request(self, tokens):', '    if self.available >= tokens:', '        self.available -= tokens', '        return True', '    return False'],
    guard: 1, allow: 3, reject: 4,
  },
};

const KEYWORDS = /\b(boolean|bool|int|if|return|true|false|def|self|True|False)\b/;
const cv = (vars: Record<string, string | number>) => vars as unknown as CSSProperties;

function Highlight({ text }: { text: string }) {
  if (!text) return <>{' '}</>;
  return <>{text.split(KEYWORDS).map((part, i) => (i % 2 === 1 ? <span key={i} className="tok-kw">{part}</span> : part))}</>;
}

function Brand() {
  return <a className="home-brand" href={links.home} aria-label="HLD Studio home"><Layers size={22}/> <span>HLD Studio</span></a>;
}

/* ---------- HLD building blocks ---------- */
function Link({ kind, count }: { kind: 'in' | 'ok'; count: number }) {
  return (
    <span className={`rd-link rd-link-${kind}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <i key={i} style={cv({ '--f': i / count })} />)}
    </span>
  );
}

function Node({ n, tone, icon, label, tip, inside, outside }: { n: number; tone: string; icon: ReactNode; label: string; tip: string; inside?: ReactNode; outside?: ReactNode }) {
  return (
    <div className={`rd-node-wrap rd-tone-${tone}`} tabIndex={0} style={cv({ '--n': n })}>
      <div className="rd-node">
        <span className="rd-node-icon">{icon}</span>
        <b>{label}</b>
        {inside}
      </div>
      <span className="rd-tip" role="tooltip">{tip}</span>
      {outside}
    </div>
  );
}

function TokenDots({ level, total = 5 }: { level: number; total?: number }) {
  return (
    <span className="rd-tokens" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < level ? (i === level - 1 ? 'on edge' : 'on') : ''} />)}
    </span>
  );
}

export default function HomeLanding() {
  const learner = useAuthStore((s) => s.learnerUser);
  const restoreLearner = useAuthStore((s) => s.restoreLearner);
  const learnerLogout = useAuthStore((s) => s.learnerLogout);
  const [split, setSplit] = useState(50);
  const [language, setLanguage] = useState<Language>('java');
  const [cycleIndex, setCycleIndex] = useState(0);
  const [pinned, setPinned] = useState<LoadState | null>(null);   // null = Auto cycle
  const [scrolled, setScrolled] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);

  const loadState: LoadState = pinned ?? CYCLE[cycleIndex];
  const cfg = CONFIG[loadState];
  const sample = codeSamples[language];

  useEffect(() => { void restoreLearner(); }, [restoreLearner]);

  /* Auto cycle: paused while a state is pinned. */
  useEffect(() => {
    if (pinned) return;
    const timer = window.setInterval(() => setCycleIndex((i) => (i + 1) % CYCLE.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [pinned]);

  /* Header gets a compact, more opaque look once the page scrolls. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    left: (i * 37 + 11) % 100, size: 2 + (i % 3), dur: 16 + ((i * 7) % 14), delay: (i * 1.7) % 20,
  })), []);

  const updateSplit = (clientX: number) => { const bounds = splitRef.current?.getBoundingClientRect(); if (bounds) setSplit(Math.max(20, Math.min(80, ((clientX - bounds.left) / bounds.width) * 100))); };
  const onDividerPointerDown = (event: PointerEvent<HTMLButtonElement>) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); updateSplit(event.clientX); };
  const onDividerPointerMove = (event: PointerEvent<HTMLButtonElement>) => { if (dragging.current) updateSplit(event.clientX); };
  const onDividerPointerUp = () => { dragging.current = false; };
  const onDividerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSplit((value) => Math.max(20, Math.min(80, value + (event.key === 'ArrowRight' ? 5 : -5)))); } };
  const onDemoMove = (event: PointerEvent<HTMLElement>) => {
    const el = demoRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - r.left}px`);
    el.style.setProperty('--my', `${event.clientY - r.top}px`);
  };

  return <div className="home-landing" data-load={loadState}>
    {/* Ambient background */}
    <div className="rd-bg" aria-hidden="true">
      <div className="rd-bg-grid"/>
      <div className="rd-orb rd-orb-a"/><div className="rd-orb rd-orb-b"/><div className="rd-orb rd-orb-c"/>
      <div className="rd-beam"/>
      {particles.map((p, i) => <i key={i} className="rd-dot" style={cv({ left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, '--t': `${p.dur}s`, '--d': `${p.delay}s` })}/>)}
    </div>

    {/* ---------------- Header: brand | tracks | account ---------------- */}
    <header className={`hdr${scrolled ? ' is-scrolled' : ''}`}>
      <div className="hdr-inner">
        <Brand />

        <nav className="hdr-nav" aria-label="Main navigation">
          <a className="hdr-tone-hld" href={links.learn}>HLD</a>
          <a className="hdr-tone-lld" href={links.lldLearn}>LLD</a>
          {/* TEMP: remove this whole block (and SHOW_ADMIN_LINK) before launch */}
          {SHOW_ADMIN_LINK && (
            <>
              <span className="hdr-nav-sep" aria-hidden="true" />
              <a className="hdr-temp" href={links.adminLogin} title="Temporary link, remove before launch">Admin</a>
            </>
          )}
        </nav>

        <div className="hdr-actions">
          {learner ? (
            <>
              <a className="hdr-btn hdr-btn-ghost" href={links.learnerProfile}>Profile</a>
              <button className="hdr-btn hdr-btn-primary" type="button" onClick={() => { void learnerLogout(); }}>Sign out</button>
            </>
          ) : (
            <>
              <a className="hdr-btn hdr-btn-ghost" href={links.userLogin}>Sign in</a>
              <a className="hdr-btn hdr-btn-primary" href={links.userSignup}>Create account</a>
            </>
          )}
        </div>
      </div>
    </header>

    <main>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-eyebrow"><span/> ENGINEERING DESIGN LEARNING PLATFORM</div>
          <h1 id="home-title">Understand systems from <span>architecture</span> to code.</h1>
          <p>Learn High-Level Design and Low-Level Design through interactive engineering problems, visual explanations and practical learning paths.</p>
          <div className="home-actions">
            <a className="home-button home-button-hld" href={links.learn}>Explore HLD Track <ArrowRight size={16}/></a>
            <a className="home-button home-button-lld" href={links.lldLearn}>Explore LLD Track <ArrowRight size={16}/></a>
          </div>
        </div>

        <section ref={demoRef} onPointerMove={onDemoMove} className="rate-demo rd" data-state={loadState} aria-label="Interactive rate limiter demonstration">
          <div className="rd-head">
            <div><span className="rd-kicker">ONE SYSTEM · TWO PERSPECTIVES</span><h2 className="rd-title">Explore a Rate Limiter</h2></div>
            <span className="rd-live"><i/> LIVE SIMULATION</span>
          </div>

          <div ref={splitRef} className="rd-split" style={cv({ '--split': `${split}%` })}>
            {/* ---------------- HLD ---------------- */}
            <div className="rd-panel rd-panel-hld">
              <div className="rd-panel-heading"><span>01 / HLD</span><b>Distributed architecture</b></div>
              <div className="rd-flow" role="group" aria-label="Client to API gateway to rate limiter to Redis" style={cv({ '--dur': `${cfg.speed}s` })}>
                <Node n={0} tone="client" icon={<Network/>} label="Client" tip="Sends requests"/>
                <Link kind="in" count={cfg.packets}/>
                <Node n={1} tone="gateway" icon={<Activity/>} label="API Gateway" tip="Routes & authenticates"/>
                <Link kind="in" count={cfg.packets}/>
                <Node
                  n={2} tone="limiter" icon={<Gauge/>} label="Rate Limiter" tip="Checks the token bucket"
                  inside={<TokenDots level={cfg.tokens}/>}
                  outside={<div className="rd-drop" aria-hidden="true">{Array.from({ length: cfg.dropped }, (_, i) => <i key={i} style={cv({ '--dx': `${((i % 3) - 1) * 16 + (i % 2) * 6}px`, '--f': i / Math.max(1, cfg.dropped) })}/>)}</div>}
                />
                <Link kind="ok" count={cfg.accepted}/>
                <Node n={3} tone="redis" icon={<Database/>} label="Redis" tip="Shared counters"/>
              </div>
              <div className="rd-hld-foot">
                <span className="rd-status-text"><i/>{cfg.status}</span>
                <span className="rd-rejectbar" aria-hidden="true"><i/></span>
              </div>
            </div>

            {/* ---------------- LLD ---------------- */}
            <div className="rd-panel rd-panel-lld">
              <div className="rd-panel-heading"><span>02 / LLD</span><b>Class &amp; implementation</b></div>
              <div className="rd-lld">
                <div className="rd-uml" aria-label="RateLimiter has a TokenBucket">
                  <div className="rd-class">
                    <div className="rd-class-name">RateLimiter</div>
                    <div className="rd-member rd-member-entry"><span>+</span> allowRequest()</div>
                    <div className="rd-member"><span>+</span> refillTokens()</div>
                  </div>
                  <div className="rd-rel" aria-hidden="true"><em/><i/></div>
                  <div className="rd-class">
                    <div className="rd-class-name">TokenBucket</div>
                    <div className="rd-member rd-member-field"><span>-</span> available <TokenDots level={cfg.tokens}/></div>
                    <div className="rd-member rd-member-hit"><span>+</span> consume()</div>
                  </div>
                </div>

                <div className="rd-code">
                  <div className="rd-code-head">
                    <span>{sample.file}</span>
                    <label className="sr-only" htmlFor="landing-language">Code preview language</label>
                    <select id="landing-language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                      <option value="java">Java</option><option value="cpp">C++</option><option value="python">Python</option>
                    </select>
                  </div>
                  <pre><code>{sample.lines.map((line, i) => (
                    <span key={`${language}-${i}`} style={cv({ '--i': i })} className={`rd-line${i === sample.guard ? ' is-guard' : ''}${i === sample.allow ? ' is-allow' : ''}${i === sample.reject ? ' is-reject' : ''}`}><Highlight text={line}/></span>
                  ))}</code></pre>
                  <div className="rd-chip"><i/>TokenBucket.consume() · {cfg.chip}</div>
                </div>
              </div>
            </div>

            <button type="button" className="rd-divider" role="slider" aria-label="Adjust HLD and LLD comparison" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(split)} onPointerDown={onDividerPointerDown} onPointerMove={onDividerPointerMove} onPointerUp={onDividerPointerUp} onPointerCancel={onDividerPointerUp} onKeyDown={onDividerKeyDown}><span>↔</span></button>
          </div>

          {/* ---------------- State controls + traffic pressure ---------------- */}
          {/* <div className="rd-status" aria-live="polite">
            <div className="rd-pills" role="group" aria-label="Traffic state">
              <button type="button" className={`rd-pill rd-pill-auto${pinned ? '' : ' is-on'}`} aria-pressed={!pinned} onClick={() => setPinned(null)}>Auto</button>
              {STATE_ORDER.map((s) => (
                <button key={s} type="button" className={`rd-pill rd-pill-${s}${loadState === s ? ' is-active' : ''}`} aria-pressed={pinned === s} onClick={() => setPinned(pinned === s ? null : s)}>
                  <i/>{CONFIG[s].pill}
                </button>
              ))}
            </div>
            <div className="rd-meter" aria-hidden="true">
              <small>Traffic pressure</small>
              <div className="rd-meter-bar">
                {Array.from({ length: METER_SEGMENTS }, (_, i) => (
                  <i key={i} style={cv({ '--i': i })} className={`${i < cfg.meter ? 'on ' : ''}${i < 12 ? 'g' : i < 20 ? 'a' : 'r'}`}/>
                ))}
              </div>
            </div>
            {!pinned && <div className="rd-cycle" aria-hidden="true"><i key={cycleIndex} style={cv({ '--cycle': `${CYCLE_MS}ms` })}/></div>}
          </div> */}

          {/* <div className="rd-tiles">
            <div className="rd-tile rd-tile-ok">
              <div className="rd-tile-head"><small>Accepted</small><Check size={15}/></div>
              <div className="rd-bars rd-bars-ok" aria-hidden="true">{Array.from({ length: BAR_COUNT }, (_, i) => <i key={i} style={cv({ '--i': i })}/>)}</div>
            </div>
            <div className="rd-tile rd-tile-bad">
              <div className="rd-tile-head"><small>Rejected</small><X size={15}/></div>
              <div className="rd-bars rd-bars-bad" aria-hidden="true">{Array.from({ length: BAR_COUNT }, (_, i) => <i key={i} style={cv({ '--i': i })} className={i < cfg.rejectBars ? 'on' : ''}/>)}</div>
            </div>
            <div className="rd-tile rd-tile-limiter">
              <div className="rd-tile-head"><small>Rate limiter</small></div>
              <div className="rd-limiter-body">
                <span className="rd-shield" aria-hidden="true">{loadState === 'normal' ? <ShieldCheck size={20}/> : <ShieldAlert size={20}/>}</span>
                <strong className="rd-limiter-label">{cfg.limiter}</strong>
              </div>
            </div>
          </div> */}

          <p className="rd-note">
            <span className="rd-hint">
              {/* {pinned ? 'State pinned. Choose Auto to resume the cycle.' : 'Pick a state to pin it, or let it cycle.'} */}
              </span>
            <span>Conceptual simulation for learning, not a production benchmark.</span>
          </p>
        </section>
      </section>

      <MacroToMicroJourney />
      <section className="track-section">
        <div className="section-heading"><span>CHOOSE YOUR PATH</span><h2>Two disciplines. One engineering mindset.</h2><p>Build the skills to reason about systems at every level.</p></div>
        <div className="track-cards">
          <a className="track-card track-card-hld" href={links.learn}><div className="track-card-top"><span>HLD / HIGH-LEVEL DESIGN</span><Network size={23}/></div><h3>Architect resilient, scalable systems.</h3><p>Learn distributed systems, capacity planning, caching, databases, reliability and architecture trade-offs.</p><div className="track-tags"><span>CAP theorem</span><span>Sharding</span><span>Consensus</span><span>Caching</span></div><strong>Explore HLD <ArrowRight size={16}/></strong></a>
          <a className="track-card track-card-lld" href={links.lldLearn}><div className="track-card-top"><span>LLD / LOW-LEVEL DESIGN</span><Code2 size={23}/></div><h3>Design clean, extensible software.</h3><p>Learn object-oriented design, SOLID principles, design patterns, UML and machine coding.</p><div className="track-tags"><span>OOP</span><span>SOLID</span><span>GoF patterns</span><span>UML</span></div><strong>Explore LLD <ArrowRight size={16}/></strong></a>
        </div>
      </section>
    </main>
    <footer className="home-footer"><Brand/><span>Learn to reason about software from architecture to implementation.</span><a href={links.learn}>Start with HLD</a><a href={links.lldLearn}>Start with LLD</a></footer>
  </div>;
}