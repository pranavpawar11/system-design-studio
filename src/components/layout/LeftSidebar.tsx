import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { question, useStudio } from '../../features/architecture/architecture.store';
import { computeMetrics, type CapacityInputs } from '../../features/evaluation/metrics';
import { REQ_GROUPS } from '../../features/questions/requirementGroups';
import { FollowUps, ReferencePanel, FOLLOW_UPS } from '../question/LearningPanels';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_HELP, categoryOf, iconOf } from './componentMeta';

function Library() {
  const addNode = useStudio((s) => s.addNode);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(CATEGORIES.map((c) => [c, question.componentCatalogue.allowedComponentIds.length <= 12 || ['Clients', 'Networking', 'Compute', 'Storage', 'Caching'].includes(c)])));
  const term = q.trim().toLowerCase();
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: question.componentCatalogue.components.filter((c) =>
      question.componentCatalogue.allowedComponentIds.includes(c.id) && (c.category ?? categoryOf(c.type)) === cat &&
      (!term || c.displayName.toLowerCase().includes(term) || c.responsibilities.join(' ').toLowerCase().includes(term))),
  })).filter((g) => g.items.length > 0);
  const setAll = (v: boolean) => setOpen(Object.fromEntries(CATEGORIES.map((c) => [c, v])));
  return (
    <div>
      <label className="search"><Search size={14} aria-hidden /><input type="search" name="component-search" autoComplete="off" spellCheck={false} aria-label="Search components" placeholder="Search components…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="lib-actions"><button onClick={() => setAll(true)}>Expand all</button><button onClick={() => setAll(false)}>Collapse all</button></div>
      {groups.length === 0 && <p className="muted">No components match “{q}”.</p>}
      {groups.map(({ cat, items }) => {
        const isOpen = term ? true : open[cat];
        return (
          <section key={cat} className="cat">
            <button className="cat-head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [cat]: !open[cat] })} style={{ borderLeftColor: CATEGORY_COLORS[cat] }}>
              {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
              <span className="cat-name">{cat}</span><span className="count">{items.length}</span>
              <small>{CATEGORY_HELP[cat]}</small>
            </button>
            {isOpen && items.map((c) => {
              const Icon = iconOf(c.type);
              return (
                <div key={c.id} className="lib-item" draggable title={c.responsibilities.join(' · ')}
                  onDragStart={(e) => { e.dataTransfer.setData('application/hld-component', c.id); e.dataTransfer.effectAllowed = 'copy'; }}>
                  <Icon size={16} color={CATEGORY_COLORS[cat]} aria-hidden />
                  <span><strong>{c.displayName}</strong><em>{c.responsibilities[0]}</em></span>
                  <button className="add" aria-label={`Add ${c.displayName}`} onClick={() => addNode(c.id)}><Plus size={14} /></button>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

const KEYS = ['newUrlsPerDay', 'redirectsPerDay', 'averageRecordBytes', 'retentionYears', 'peakMultiplier', 'cacheHitRatio'] as const;
function Capacity() {
  const defs = question.capacityEstimation.defaultInputs;
  const isUrl = defs.length === 6 && defs[0].id === 'CAP-IN-01';
  let m: ReturnType<typeof computeMetrics> | null = null; let err = '';
  if (isUrl) {
    try { m = computeMetrics(Object.fromEntries(KEYS.map((k, i) => [k, defs[i].value])) as unknown as CapacityInputs); } catch (e) { err = (e as Error).message; }
  }
  const f = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const clients = defs.find((d) => d.id === 'RL-IN-03')?.value; const rec = defs.find((d) => d.id === 'RL-IN-04')?.value;
  return (
    <div>
      <h3>Given assumptions</h3>
      <dl className="kv">{defs.map((d) => <div key={d.id}><dt>{d.name}</dt><dd>{f(d.value)} <small>{d.unit}</small></dd></div>)}</dl>
      {err && <p className="err" role="alert">{err}</p>}
      {(m || (clients && rec)) && <h3>Worked out for you</h3>}
      {m && <dl className="kv">
        <div><dt>Avg creation rate</dt><dd>{f(m.avgCreate)} <small>req/s</small></dd></div>
        <div><dt>Avg redirect rate</dt><dd>{f(m.avgRedirect)} <small>req/s</small></dd></div>
        <div><dt>Peak redirect rate</dt><dd>{f(m.peakRedirect)} <small>req/s</small></dd></div>
        <div><dt>Read : write ratio</dt><dd>{m.readWriteRatio === null ? 'n/a' : f(m.readWriteRatio)}</dd></div>
        <div><dt>Raw storage</dt><dd>{f(m.rawStorageBytes / 1e12)} <small>TB</small></dd></div>
        <div><dt>DB reads with cache</dt><dd>{f(m.dbReadsWithCache)} <small>reads/s</small></dd></div>
      </dl>}
      {!m && clients && rec && <dl className="kv"><div><dt>Counter memory</dt><dd>{f((clients * rec) / 1e6)} <small>MB</small></dd></div></dl>}
      <p className="ro-note">🔒 These values are fixed for this question. To try other loads, use the what-if controls in the Metrics tab.</p>
      {isUrl && <p className="muted">Simplified averages. Raw storage excludes indexes, replicas and backups (365-day years).</p>}
    </div>
  );
}

function Outline() {
  const { doc, selIds, selEdge, report, focus, select } = useStudio();
  const flagged = new Set(report?.findings.filter((f) => f.severity === 'error' || f.severity === 'warning').flatMap((f) => f.nodeIds));
  const nm = (id: string) => doc.nodes.find((n) => n.id === id)?.name ?? id;
  const ct = (id: string) => question.connectionTypes.find((c) => c.id === id)?.name ?? id;
  if (!doc.nodes.length) return <div><div className="empty"><b>Nothing here yet</b><p>Add components from the Components tab and they will be listed here.</p></div></div>;
  return (
    <div>
      <h3>Components ({doc.nodes.length})</h3>
      {doc.nodes.map((n) => {
        const Icon = iconOf(n.componentType); const k = categoryOf(n.componentType);
        const inc = doc.edges.filter((e) => e.target === n.id).length; const out = doc.edges.filter((e) => e.source === n.id).length;
        return (
          <button key={n.id} className={`outline-item${selIds.includes(n.id) ? ' on' : ''}`} onClick={() => focus(n.id)}>
            <Icon size={16} color={CATEGORY_COLORS[k]} aria-hidden />
            <span><b>{flagged.has(n.id) ? '⚠ ' : ''}{n.name}</b><small>{inc} in · {out} out{inc + out === 0 ? ' · not connected' : ''}</small></span>
          </button>
        );
      })}
      <h3>Connections ({doc.edges.length})</h3>
      {doc.edges.length === 0 && <p className="muted">No connections yet.</p>}
      {doc.edges.map((e) => (
        <button key={e.id} className={`outline-item outline-edge${selEdge === e.id ? ' on' : ''}`} onClick={() => select(null, e.id)}>
          <span>{nm(e.source)} → {nm(e.target)}<small>{ct(e.connectionTypeId)}</small></span>
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return <details className="sec" open={defaultOpen}><summary>{title}</summary>{children}</details>;
}

function Question() {
  const { hints, revealHint, report, answers } = useStudio();
  const interviewOn = useStudio((s) => !!s.interview && !s.interview.endedAt);
  const [visible, setVisible] = useState<string[]>(hints);
  const sorted = [...question.hints].sort((x, y) => x.level - y.level);
  const nextHint = sorted.find((h) => !hints.includes(h.id));
  const present = (question as unknown as { presentation?: { problemStatement?: { short?: string; full?: string }; scope?: { inScope?: string[]; outOfScope?: string[] } } }).presentation;
  const problem = present?.problemStatement ?? {}; const scope = present?.scope;
  const objectives = (question.question as { learningObjectives?: string[] }).learningObjectives ?? [];
  const assumptions = (question as unknown as { assumptions?: { id: string; description: string }[] }).assumptions ?? [];
  const reqs = question.requirements as { functional: { id: string; title: string }[]; nonFunctional: { id: string; title: string }[] } | undefined;
  const all = [...(reqs?.functional ?? []), ...(reqs?.nonFunctional ?? [])];
  const status = (id: string) => report?.requirements.find((r) => r.requirementId === id)?.status;
  const passed = all.filter((r) => status(r.id) === 'pass').length;
  const reviewed = FOLLOW_UPS.filter((f) => answers[f.id]?.revealed).length;
  const badge = (id: string) => { const st = status(id); return st ? <span className={`badge ${st}`}>{st === 'pass' ? '✓ Met' : st === 'fail' ? '✗ Not met' : '? Unverified'}</span> : null; };
  return (
    <div>
      <h2>{question.question.title}</h2>
      <p className="muted">{question.question.difficulty} · ~{(question.question as { estimatedMinutes?: number }).estimatedMinutes ?? '?'} min</p>
      <div className="progress" aria-label="Progress"><span>Checks passed <b>{report ? `${passed}/${all.length}` : '—'}</b></span><span>Hints used <b>{hints.length}/{sorted.length}</b></span><span>Follow-ups <b>{reviewed}/{FOLLOW_UPS.length}</b></span></div>
      <Section title="The problem" defaultOpen>
        {problem.full ? <p>{problem.full}</p> : problem.short ? <p>{problem.short}</p> : <p className="muted">No problem statement has been written for this question.</p>}
        {(scope?.inScope?.length ?? 0) > 0 && <><h3>In scope</h3><ul>{scope!.inScope!.map((x) => <li key={x}>{x}</li>)}</ul></>}
        {(scope?.outOfScope?.length ?? 0) > 0 && <><h3>Out of scope</h3><ul>{scope!.outOfScope!.map((x) => <li key={x}>{x}</li>)}</ul></>}
        {objectives.length > 0 && <><h3>What you will practise</h3><ul>{objectives.map((x) => <li key={x}>{x}</li>)}</ul></>}
        {assumptions.length > 0 && <><h3>Assumptions</h3><ul>{assumptions.map((a) => <li key={a.id}>{a.description}</li>)}</ul></>}
      </Section>
      <Section title={`Requirements (${all.length})`} defaultOpen>
        {REQ_GROUPS.map((g) => (
          <details key={g.label} className="subsec" open>
            <summary><span>{g.label}</span><small>{g.hint}</small></summary>
            {g.items.map((r) => <div key={r.id} className="req" title={r.id}><span>{r.title}</span>{badge(r.id)}</div>)}
          </details>
        ))}
        {!report && <p className="muted">Click Validate to see which requirements your design meets.</p>}
      </Section>
      <Section title={`Hints (${hints.length}/${sorted.length} used)`}>
        <div className="hintbar" role="progressbar" aria-label="Hints used" aria-valuemin={0} aria-valuemax={sorted.length} aria-valuenow={hints.length}><i style={{ width: `${(hints.length / sorted.length) * 100}%` }} /></div>
        <p className="muted">Hints get more specific as you go. Each is counted in your summary.</p>
        {sorted.map((h) => {
          const used = hints.includes(h.id); const isNext = nextHint?.id === h.id; const shown = visible.includes(h.id);
          if (used) return (
            <div key={h.id} className="hcard"><div className="hcard-head"><span className="hlevel">Hint {h.level}</span>
              <button className="toggle" onClick={() => setVisible(shown ? visible.filter((x) => x !== h.id) : [...visible, h.id])}>{shown ? 'Hide' : 'Show'}</button></div>
              <p className={shown ? '' : 'hidden-text'}>{shown ? h.text : 'Hidden. Click Show to read it again.'}</p></div>
          );
          return (
            <div key={h.id} className={`hcard ${isNext ? 'next' : 'locked'}`}>
              <div className="hcard-head"><span className="hlevel">Hint {h.level}</span>{!isNext && <span aria-hidden>🔒</span>}</div>
              {isNext ? <button className="primary block" disabled={interviewOn} onClick={() => { revealHint(h.id); setVisible([...visible, h.id]); }}>{interviewOn ? 'Disabled in interview mode' : `Reveal hint ${h.level}`}</button>
                : <p className="muted">Locked. Reveal the previous hint first.</p>}
            </div>
          );
        })}
        {!nextHint && <p className="muted">You have used every hint.</p>}
      </Section>
      <Section title="Capacity estimates"><Capacity /></Section>
      <Section title={`Follow-up questions (${reviewed}/${FOLLOW_UPS.length})`}><FollowUps /></Section>
    </div>
  );
}

export default function LeftSidebar() {
  const leftWidth = useStudio((s) => s.leftWidth);
  const [tab, setTab] = useState<'components' | 'question' | 'outline' | 'reference'>('components');
  return (
    <aside className="sidebar sidebar-left" style={{ width: leftWidth }} aria-label="Library and question">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'components'} onClick={() => setTab('components')}>Components</button>
        <button role="tab" aria-selected={tab === 'question'} onClick={() => setTab('question')}>Question</button>
        <button role="tab" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>Outline</button>
        <button role="tab" aria-selected={tab === 'reference'} onClick={() => setTab('reference')}>Reference</button>
      </div>
      <div className="panel">{tab === 'components' ? <Library /> : tab === 'question' ? <Question /> : tab === 'outline' ? <Outline /> : <ReferencePanel />}</div>
    </aside>
  );
}
