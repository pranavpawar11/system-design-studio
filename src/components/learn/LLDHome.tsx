import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X, Maximize2, Minimize2, Code2, BookOpen, Layers3 } from 'lucide-react';
import roadmapJson from '../../data/learning/lld/roadmap.json';
import practiceJson from '../../data/learning/lld/practice-catalogue.json';
import type { Roadmap, RoadmapNode } from '../../features/learning/types';
import type { NodeState } from '../../features/learning/progress';
import { links } from '../../app/route';
import { getLLDLessonProgress, isLLDLessonComplete, lldProgressChangeEvent } from '../../features/learning/lld-progress';
import { PROGRAMMING_LANGUAGES, useProgrammingLanguage } from '../../features/learning/programming-language';

type LLDNode = RoadmapNode & { code?: string; children?: LLDNode[] };
const roadmap = roadmapJson as unknown as Omit<Roadmap, 'nodes'> & { nodes: LLDNode[] };
const practice = practiceJson as { problems: { id: string; title: string; category: string; difficulty: string; priority: string; concepts: string[] }[]; categories: { id: string; title: string; problemCount: number }[] };
const LABEL: Record<NodeState, string> = { done: 'Done', doing: 'In progress', todo: 'Not started', planned: 'Content planned' };
const count = (n: RoadmapNode) => (n.children ?? []).reduce((sum, group) => sum + (group.children?.length ?? 0), 0);
const countReadyLessons = (nodes: RoadmapNode[]): number => nodes.reduce(
  (sum, node) => sum + (node.kind === 'lesson' && node.status === 'ready' ? 1 : 0) + countReadyLessons(node.children ?? []),
  0,
);
const isFoundation = (n: RoadmapNode) => n.id.includes('level-00-');
function matches(n: RoadmapNode, q: string): boolean {
  return !q || `${n.title} ${n.summary ?? ''}`.toLowerCase().includes(q) || Boolean(n.children?.some((c) => matches(c, q)));
}
function Mark({ state }: { state: NodeState }) { return <span className={`mark ${state}`} aria-hidden>{state === 'done' ? '✓' : ''}</span>; }

export default function LLDHome() {
  const programmingLanguage = useProgrammingLanguage();
  const languageMeta = PROGRAMMING_LANGUAGES.find((item) => item.id === programmingLanguage) ?? PROGRAMMING_LANGUAGES.find((item) => item.id === 'java')!;
  const [query, setQuery] = useState('');
  const [, setProgressVersion] = useState(0);
  useEffect(() => { const refresh = () => setProgressVersion((v) => v + 1); window.addEventListener(lldProgressChangeEvent(), refresh); return () => window.removeEventListener(lldProgressChangeEvent(), refresh); }, []);
  const [showFoundations, setShowFoundations] = useState(false);
  const [showPractice, setShowPractice] = useState(true);
  const [open, setOpen] = useState<Set<string>>(() => new Set(['level-01-object-oriented-programming-fundamentals', 'level-02-object-modeling-and-uml', 'level-03-design-principles-and-design-heuristics']));
  const q = query.trim().toLowerCase();
  const allLevels = roadmap.nodes.filter((n) => matches(n, q));
  const foundations = allLevels.filter(isFoundation);
  const core = allLevels.filter((n) => !isFoundation(n));
  const visible = q ? allLevels : core;
  const totalTopics = visible.reduce((sum, n) => sum + count(n), 0);
  const publishedLessons = countReadyLessons(roadmap.nodes);
  const flattenRoadmap = (nodes: RoadmapNode[]): RoadmapNode[] => nodes.flatMap((node) => [node, ...flattenRoadmap(node.children ?? [])]);
  const allNodes = flattenRoadmap(roadmap.nodes);
  const completedLessons = allNodes.filter((node) => node.kind === 'lesson' && node.status === 'ready' && isLLDLessonComplete(getLLDLessonProgress(node.id))).length;
  const toggle = (id: string) => setOpen((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const expandAll = () => setOpen(new Set(visible.map((n) => n.id)));
  const collapseAll = () => setOpen(new Set());

  return <div className="learn-wrap lld-home">
    <section className="learn-hero lld-hero-static" aria-labelledby="lld-hero-title">
      <div className="learn-hero-copy">
        <div className="eyebrow">LOW-LEVEL DESIGN · {languageMeta.label.toUpperCase()} LEARNING PATH</div>
        <h2 id="lld-hero-title">Design better software, one object at a time.</h2>
        <p className="lead">Learn to turn requirements into clean, maintainable and testable code. Progress from object-oriented fundamentals to design patterns, concurrency, machine coding and complete case studies.</p>
        <div className="lld-hero-tags"><span><Code2 size={14}/> {languageMeta.label} examples</span><span><Layers3 size={14}/> 12 learning levels</span><span><BookOpen size={14}/> 422 lesson topics</span></div>
      </div>
      <div className="learn-progress-card lld-overview-card">
        <div className="learn-progress-head"><span>Curriculum overview</span><b>12</b></div>
        <div className="lld-stat-grid"><div><strong>11</strong><small>Core levels</small></div><div><strong>1</strong><small>Optional foundation</small></div><div><strong>{practice.problems.length}</strong><small>Practice problems</small></div></div>
        <p className="learn-progress-note">Lesson content will be authored and reviewed progressively. Planned topics remain visible so the complete learning path is clear.</p>
      </div>
    </section>

    <section className="roadmap-toolbar" aria-label="LLD roadmap controls">
      <div><h2 className="roadmap-h">Your LLD learning path</h2><p className="roadmap-sub">{visible.length} levels · {totalTopics} topics in view · {publishedLessons} lessons available · {completedLessons} completed · Global language preference: {languageMeta.label}</p></div>
      <div className="roadmap-actions">
        <label className="roadmap-search"><Search size={16} aria-hidden/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search OOP, SOLID, patterns, concurrency…" aria-label="Search LLD roadmap"/>{query && <button className="icon-btn" type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</label>
        <button type="button" className="roadmap-control" onClick={expandAll}><Maximize2 size={14}/> Expand all</button>
        <button type="button" className="roadmap-control" onClick={collapseAll}><Minimize2 size={14}/> Collapse all</button>
      </div>
    </section>

    <ul className="legend" aria-label="Progress key">{(['done','doing','todo','planned'] as NodeState[]).map((state) => <li key={state}><Mark state={state}/>{LABEL[state]}</li>)}</ul>

    {visible.length === 0 ? <div className="roadmap-empty"><Search size={22}/><b>No topics match “{query}”</b><span>Try another keyword or clear the search.</span><button onClick={() => setQuery('')}>Clear search</button></div> : <ol className="spine">{visible.map((level) => {
      const lp = { state: 'planned' as NodeState };
      const isOpen = Boolean(q) || open.has(level.id);
      const levelMatch = q && `${level.title} ${level.summary ?? ''}`.toLowerCase().includes(q);
      const groups = (level.children ?? []).filter((g) => !q || levelMatch || matches(g, q));
      return <li key={level.id} className={`spine-item ${lp.state}`}><span className="spine-dot"><Mark state={lp.state}/></span><section className="topic" aria-labelledby={`lld-${level.id}`}>
        <h3 id={`lld-${level.id}`}><button className="topic-head" aria-expanded={isOpen} onClick={() => toggle(level.id)}>{isOpen ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}<span className="topic-num">{level.code}</span><span className="topic-title">{level.title}</span><span className="topic-count">{count(level)} topics</span><span className="topic-state planned">Content planned</span></button></h3>
        <p className="topic-sum">{level.summary}</p>
        {isOpen && <div className="tree">{groups.map((group) => {
          const lessons = (group.children ?? []).filter((lesson) => !q || levelMatch || matches(group, q) || matches(lesson, q));
          return <section key={group.id} className="branch"><h4><span>{group.title}</span><small>{lessons.length} topics · {lessons.filter((item) => item.status === 'ready').length} available · {lessons.filter((item) => item.status !== 'ready').length} planned</small></h4><ul>{lessons.map((lesson) => <li key={lesson.id} className={`leaf ${lesson.status === 'ready' ? 'ready' : 'planned'}`}>{lesson.status === 'ready' ? <a href={links.lldLesson(lesson.id)}><Mark state={isLLDLessonComplete(getLLDLessonProgress(lesson.id)) ? 'done' : (getLLDLessonProgress(lesson.id).read || getLLDLessonProgress(lesson.id).quizPassed ? 'doing' : 'todo')}/><span className="leaf-title">{lesson.title}</span><span className={`leaf-state ${isLLDLessonComplete(getLLDLessonProgress(lesson.id)) ? 'ready' : 'planned'}`}>{isLLDLessonComplete(getLLDLessonProgress(lesson.id)) ? 'Completed' : getLLDLessonProgress(lesson.id).read || getLLDLessonProgress(lesson.id).quizPassed ? 'In progress' : `Start lesson · ${lesson.minutes ?? 10} min`}</span></a> : <div className="leaf-planned"><Mark state="planned"/><span className="leaf-title">{lesson.title}</span><span className="leaf-state planned">Content planned</span></div>}</li>)}</ul></section>;
        })}</div>}
      </section></li>;
    })}</ol>}

    {!q && foundations.length > 0 && <section className="foundations-drawer"><button type="button" className="foundations-toggle" aria-expanded={showFoundations} onClick={() => setShowFoundations((v) => !v)}><span className="foundations-toggle-icon">{showFoundations ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</span><span className="foundations-toggle-copy"><b>Programming foundations & prerequisites</b><small>Optional refreshers for programming and computer science basics</small></span><span className="foundations-count">{count(foundations[0])} topics</span></button>{showFoundations && <ol className="spine foundations-spine">{foundations.map((level) => <li key={level.id} className="spine-item planned"><span className="spine-dot"><Mark state="planned"/></span><section className="topic"><h3><button className="topic-head" onClick={() => toggle(level.id)} aria-expanded={open.has(level.id)}>{open.has(level.id) ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}<span className="topic-num">{level.code}</span><span className="topic-title">{level.title}</span><span className="topic-count">{count(level)} topics</span></button></h3><p className="topic-sum">{level.summary}</p>{open.has(level.id) && <div className="tree">{(level.children ?? []).map((group) => <section key={group.id} className="branch"><h4><span>{group.title}</span><small>{group.children?.length ?? 0} topics</small></h4><ul>{(group.children ?? []).map((lesson) => <li key={lesson.id} className="leaf planned"><div className="leaf-planned"><Mark state="planned"/><span className="leaf-title">{lesson.title}</span><span className="leaf-state planned">Content planned</span></div></li>)}</ul></section>)}</div>}</section></li>)}</ol>}</section>}

    <section className="lld-practice-section">
      <button className="lld-practice-heading" type="button" aria-expanded={showPractice} onClick={() => setShowPractice((v) => !v)}><span><b>Practice library</b><small>Apply the concepts through design exercises and machine-coding challenges.</small></span><span className="lld-practice-total">{practice.problems.length} problems {showPractice ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}</span></button>
      {showPractice && <div className="lld-practice-grid">{practice.categories.map((category) => <article className="lld-practice-card" key={category.id}><div><b>{category.title}</b><span>{category.problemCount} problems</span></div><p>{practice.problems.filter((problem) => problem.category === category.id).slice(0, 3).map((problem) => problem.title).join(' · ')}</p></article>)}</div>}
    </section>
  </div>;
}
