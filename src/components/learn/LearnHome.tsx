import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FlaskConical, ListChecks, Search, X, Maximize2, Minimize2 } from 'lucide-react';
import { links } from '../../app/route';
import { useLearn, useProgress } from '../../features/learning/learn.store';
import type { NodeProgress, NodeState } from '../../features/learning/progress';
import type { RoadmapNode } from '../../features/learning/types';
import Modal from '../ui/Modal';

const LABEL: Record<NodeState, string> = { done: 'Done', doing: 'In progress', todo: 'Not started', planned: 'Content planned' };
const label = (p: NodeProgress) => (p.caughtUp ? 'All available done' : LABEL[p.state]);
function Mark({ p }: { p: NodeProgress }) {
  return <span className={`mark ${p.state}${p.caughtUp ? ' caught' : ''}`} aria-hidden>{p.state === 'done' ? '✓' : ''}</span>;
}
const count = (p: NodeProgress) => (p.total === 0 ? `${p.planned} topics planned` : `${p.done}/${p.total} lessons done${p.planned ? ` · ${p.planned} planned` : ''}`);
const isFoundation = (node: RoadmapNode) => Number(node.id.match(/level-(\d+)/)?.[1] ?? 99) <= 2;
const topicTotal = (node: RoadmapNode) => (node.children ?? []).reduce((sum, group) => sum + (group.children?.length ?? 0), 0);

function hasMatch(node: RoadmapNode, q: string): boolean {
  if (!q) return true;
  if (`${node.title} ${node.summary ?? ''}`.toLowerCase().includes(q)) return true;
  return Boolean(node.children?.some((child) => hasMatch(child, q)));
}

function Lesson({ n, p }: { n: RoadmapNode; p: NodeProgress }) {
  const body = (
    <>
      <Mark p={p} />
      <span className="leaf-title">{n.title}</span>
      {n.status === 'ready' && (
        <span className="leaf-meta">
          {n.minutes} min
          {n.hasLab && <span className="chip"><FlaskConical size={12} aria-hidden /> Lab</span>}
          {n.hasQuiz && <span className="chip"><ListChecks size={12} aria-hidden /> Quiz</span>}
        </span>
      )}
      <span className={`leaf-state ${p.state}`}>{label(p)}</span>
    </>
  );
  return <li className={`leaf ${p.state}`}>{n.status === 'ready' ? <a href={links.lesson(n.id)}>{body}</a> : <div className="leaf-planned">{body}</div>}</li>;
}

export default function LearnHome() {
  const roadmap = useLearn((s) => s.roadmap)!;
  const reset = useLearn((s) => s.reset);
  const p = useProgress()!;
  const [query, setQuery] = useState('');
  const [showFoundations, setShowFoundations] = useState(() => roadmap.nodes.some((level) =>
    isFoundation(level) && level.children?.some((group) => group.children?.some((lesson) => p.byId.get(lesson.id)?.state === 'doing'))
  ));
  const [open, setOpen] = useState<Set<string>>(() => {
    const active = roadmap.nodes.filter((t) =>
      t.children?.some((g) => g.children?.some((l) => p.byId.get(l.id)?.state === 'doing'))
    );
    return new Set(active.map((t) => t.id));
  });
  const [confirm, setConfirm] = useState(false);
  const q = query.trim().toLowerCase();
  const allVisibleLevels = useMemo(() => roadmap.nodes.filter((n) => hasMatch(n, q)), [roadmap.nodes, q]);
  const foundationLevels = allVisibleLevels.filter(isFoundation);
  const coreLevels = allVisibleLevels.filter((n) => !isFoundation(n));
  const visibleLevels = q ? allVisibleLevels : coreLevels;
  const visibleTopicCount = useMemo(() => visibleLevels.reduce((sum, level) =>
    sum + (level.children ?? []).reduce((s, group) => s + (group.children ?? []).filter((lesson) => hasMatch(lesson, q) || hasMatch(group, q) || hasMatch(level, q)).length, 0), 0), [visibleLevels, q]);
  const finished = p.total > 0 && p.done === p.total;
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandAll = () => setOpen(new Set([...visibleLevels, ...(!q && showFoundations ? foundationLevels : [])].map((n) => n.id)));
  const collapseAll = () => setOpen(new Set());

  return (
    <div className="learn-wrap">
      <section className="learn-hero" aria-labelledby="hero-h">
        <div className="learn-hero-copy">
          <div className="eyebrow">CORE SYSTEM DESIGN PATH · 9 STAGES</div>
          <h2 id="hero-h">Build the skills to design reliable, scalable systems.</h2>
          <p className="lead">Start with high-level design, master the building blocks, then work through scale, distributed systems and production architecture. Foundational computer science topics remain available when you need them.</p>
        </div>
        <div className="learn-progress-card">
          <div className="learn-progress-head"><span>Your learning progress</span><b>{p.percent}%</b></div>
          <div className="bar big" role="progressbar" aria-label="Overall progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent}><i style={{ width: `${p.percent}%` }} /></div>
          <div className="learn-progress-stats">
            <span><b>{p.done}</b> completed</span>
            <span><b>{p.total}</b> available</span>
            <span><b>{p.planned}</b> planned</span>
          </div>
          {p.nextUp ? (
            <a className="continue" href={links.lesson(p.nextUp.id)}>
              <span className="continue-label">{p.byId.get(p.nextUp.id)?.state === 'doing' ? 'Continue learning' : 'Suggested starting point'}</span>
              <b>{p.nextUp.title}</b>
              <span>{p.nextUp.minutes} min{p.nextUp.hasLab ? ' · lab' : ''}{p.nextUp.hasQuiz ? ' · quiz' : ''}</span>
            </a>
          ) : finished ? <p className="learn-finished">You have completed every published lesson. More topics are ready to be authored.</p> :
            <p className="learn-progress-note">Lessons will become available as their content is authored and reviewed.</p>}
        </div>
      </section>

      <section className="roadmap-toolbar" aria-label="Roadmap controls">
        <div>
          <h2 className="roadmap-h">Your core learning path</h2>
          <p className="roadmap-sub">9 focused stages · {visibleTopicCount} topics in view · foundations are optional</p>
        </div>
        <div className="roadmap-actions">
          <label className="roadmap-search">
            <Search size={16} aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search concepts, topics or levels…" aria-label="Search the learning roadmap" />
            {query && <button className="icon-btn" type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
          </label>
          <button type="button" className="roadmap-control" onClick={expandAll}><Maximize2 size={14} aria-hidden /> Expand all</button>
          <button type="button" className="roadmap-control" onClick={collapseAll}><Minimize2 size={14} aria-hidden /> Collapse all</button>
        </div>
      </section>

      <ul className="legend" aria-label="Progress key">
        {(['done', 'doing', 'todo', 'planned'] as NodeState[]).map((s) => <li key={s}><span className={`mark ${s}`} aria-hidden>{s === 'done' ? '✓' : ''}</span>{LABEL[s]}</li>)}
      </ul>

      {visibleLevels.length === 0 ? (
        <div className="roadmap-empty"><Search size={22} /><b>No topics match “{query}”</b><span>Try another keyword, or clear the search.</span><button onClick={() => setQuery('')}>Clear search</button></div>
      ) : (
        <ol className="spine">{visibleLevels.map((t) => {
          const tp = p.byId.get(t.id)!;
          const isOpen = q ? true : open.has(t.id);
          const panel = `panel-${t.id}`;
          const levelMatches = q && `${t.title} ${t.summary ?? ''}`.toLowerCase().includes(q);
          const groups = (t.children ?? []).filter((g) => !q || levelMatches || hasMatch(g, q));
          const lessonCount = topicTotal(t);
          return (
            <li key={t.id} className={`spine-item ${tp.state}`}>
              <span className="spine-dot"><Mark p={tp} /></span>
              <section className="topic" aria-labelledby={`h-${t.id}`}>
                <h3 id={`h-${t.id}`}>
                  <button className="topic-head" aria-expanded={isOpen} aria-controls={panel} onClick={() => toggle(t.id)}>
                    {isOpen ? <ChevronDown size={17} aria-hidden /> : <ChevronRight size={17} aria-hidden />}
                    <span className="topic-num">{t.id.match(/level-(\d+)/)?.[1] ?? ''}</span>
                    <span className="topic-title">{t.title.replace(/^Level \d+ · /, '')}</span>
                    <span className="topic-count">{lessonCount} topics</span>
                    <span className={`topic-state ${tp.state}`}>{label(tp)}</span>
                  </button>
                </h3>
                <p className="topic-sum">{t.summary}</p>
                <div className="topic-prog"><div className="bar" aria-hidden><i style={{ width: `${tp.percent}%` }} /></div><small>{count(tp)}</small></div>
                {isOpen && <div id={panel} className="tree">{groups.map((g) => {
                  const gp = p.byId.get(g.id)!;
                  const groupMatches = q && `${g.title} ${g.summary ?? ''}`.toLowerCase().includes(q);
                  const lessons = (g.children ?? []).filter((l) => !q || levelMatches || groupMatches || hasMatch(l, q));
                  return <section key={g.id} className="branch"><h4><span>{g.title}</span><small>{lessons.length} topics · {count(gp)}</small></h4><ul>{lessons.map((l) => <Lesson key={l.id} n={l} p={p.byId.get(l.id)!} />)}</ul></section>;
                })}</div>}
              </section>
            </li>
          );
        })}</ol>
      )}

      {!q && foundationLevels.length > 0 && (
        <section className="foundations-drawer" aria-label="Optional foundations">
          <button type="button" className="foundations-toggle" aria-expanded={showFoundations} onClick={() => setShowFoundations((value) => !value)}>
            <span className="foundations-toggle-icon">{showFoundations ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
            <span className="foundations-toggle-copy"><b>Foundations & prerequisites</b><small>Optional refreshers in computer science, networking and backend fundamentals</small></span>
            <span className="foundations-count">3 levels · {foundationLevels.reduce((sum, level) => sum + topicTotal(level), 0)} topics</span>
          </button>
          {showFoundations && <ol className="spine foundations-spine">{foundationLevels.map((t) => {
            const tp = p.byId.get(t.id)!;
            const isOpen = open.has(t.id);
            const panel = `panel-${t.id}`;
            const groups = t.children ?? [];
            return <li key={t.id} className={`spine-item ${tp.state}`}><span className="spine-dot"><Mark p={tp} /></span><section className="topic" aria-labelledby={`h-${t.id}`}>
              <h3 id={`h-${t.id}`}><button className="topic-head" aria-expanded={isOpen} aria-controls={panel} onClick={() => toggle(t.id)}>{isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}<span className="topic-num">{t.id.match(/level-(\d+)/)?.[1] ?? ''}</span><span className="topic-title">{t.title.replace(/^Level \d+ · /, '')}</span><span className="topic-count">{topicTotal(t)} topics</span><span className={`topic-state ${tp.state}`}>{label(tp)}</span></button></h3>
              <p className="topic-sum">{t.summary}</p><div className="topic-prog"><div className="bar" aria-hidden><i style={{ width: `${tp.percent}%` }} /></div><small>{count(tp)}</small></div>
              {isOpen && <div id={panel} className="tree">{groups.map((g) => { const gp = p.byId.get(g.id)!; return <section key={g.id} className="branch"><h4><span>{g.title}</span><small>{(g.children ?? []).length} topics · {count(gp)}</small></h4><ul>{(g.children ?? []).map((l) => <Lesson key={l.id} n={l} p={p.byId.get(l.id)!} />)}</ul></section>; })}</div>}
            </section></li>;
          })}</ol>}
        </section>
      )}

      <p className="learn-foot"><button className="ghost" onClick={() => setConfirm(true)}>Reset my progress…</button></p>
      {confirm && (
        <Modal label="Reset progress" onClose={() => setConfirm(false)}>
          <h2>Reset your progress?</h2><p>Every lesson goes back to “Not started”. This cannot be undone.</p>
          <div className="modal-actions"><button data-autofocus onClick={() => setConfirm(false)}>Cancel</button><button className="danger" onClick={() => { void reset(); setConfirm(false); }}>Reset progress</button></div>
        </Modal>
      )}
    </div>
  );
}
