import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Code2, LogOut, UserRound, CheckCircle2, CircleDashed } from 'lucide-react';
import { links } from '../../app/route';
import { useAuthStore } from '../auth/authStore';
import { learnerProgressApi } from '../../api/learning/LearnerProgressApi';
import { learnerQuestionProgressApi, type LearnerQuestionItem } from '../../api/learning/LearnerQuestionProgressApi';
import type { ProgressEvent } from '../learning/types';
import './profile.css';

type Filter = 'all' | 'solved' | 'in-progress' | 'not-started';
export default function LearnerProfilePage() {
  const user = useAuthStore((s) => s.learnerUser);
  const restore = useAuthStore((s) => s.restoreLearner);
  const logout = useAuthStore((s) => s.learnerLogout);
  const [hld, setHld] = useState<ProgressEvent[]>([]);
  const [lld, setLld] = useState<ProgressEvent[]>([]);
  const [questions, setQuestions] = useState<LearnerQuestionItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState('');

  const loadProfile = useCallback(async () => {
    const [h, l, q] = await Promise.all([
      learnerProgressApi.get('hld'), learnerProgressApi.get('lld'), learnerQuestionProgressApi.list(),
    ]);
    setHld(h); setLld(l); setQuestions(q);
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      const signedIn = await restore();
      if (!active) return;
      if (!signedIn) { window.location.hash = links.userLogin; return; }
      try { await loadProfile(); }
      catch (e) { if (active) setError((e as Error).message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [restore, loadProfile]);

  const summary = useMemo(() => (events: ProgressEvent[]) => ({
    lessons: new Set(events.filter((e) => e.type === 'lesson_read' || e.type === 'lab_completed' || e.type === 'quiz_passed').map((e) => e.nodeId)).size,
    labs: new Set(events.filter((e) => e.type === 'lab_completed').map((e) => e.nodeId)).size,
    quizzes: new Set(events.filter((e) => e.type === 'quiz_passed').map((e) => e.nodeId)).size,
  }), []);
  const h = summary(hld); const l = summary(lld);
  const solved = questions.filter((q) => q.progress?.status === 'SOLVED').length;
  const inProgress = questions.filter((q) => q.progress?.status === 'IN_PROGRESS').length;
  const visibleQuestions = questions.filter((q) => {
    const state = q.progress?.status === 'SOLVED' ? 'solved' : q.progress ? 'in-progress' : 'not-started';
    return (filter === 'all' || filter === state) && `${q.title} ${q.category} ${q.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase());
  });
  const updateQuestion = async (q: LearnerQuestionItem, action: 'start' | 'manual_solve' | 'reopen') => {
    setActionId(q.id); setError('');
    try {
      await learnerQuestionProgressApi.update(q.id, action);
      setQuestions(await learnerQuestionProgressApi.list());
    } catch (e) { setError((e as Error).message); }
    finally { setActionId(''); }
  };
  const signOut = async () => { setBusy(true); try { await logout(); window.location.hash = links.home; } finally { setBusy(false); } };

  if (loading) return <main className="learner-profile-page"><p>Loading your profile…</p></main>;
  if (!user) return null;
  return <main className="learner-profile-page">
    <header className="profile-header"><a href={links.learn}><ArrowLeft size={16}/> Back to learning</a><button onClick={signOut} disabled={busy}><LogOut size={15}/> {busy ? 'Signing out…' : 'Sign out'}</button></header>
    <section className="profile-identity"><div className="profile-avatar"><UserRound size={26}/></div><div><span className="profile-kicker">LEARNER ACCOUNT</span><h1>{user.name}</h1><p>{user.email}</p></div></section>
    <section className="profile-section"><div className="profile-section-heading"><BookOpen/><div><h2>Learning progress</h2><p>Your progress synced to your account</p></div></div>
      <div className="profile-track-grid"><article><span>HLD · High-Level Design</span><strong>{h.lessons}</strong><small>Lessons with recorded activity</small><div className="profile-metrics"><span>{h.labs} labs completed</span><span>{h.quizzes} quizzes passed</span></div></article><article><span>LLD · Low-Level Design</span><strong>{l.lessons}</strong><small>Lessons with recorded activity</small><div className="profile-metrics"><span>{l.labs} labs completed</span><span>{l.quizzes} quizzes passed</span></div></article></div>
    </section>
    <section className="profile-section profile-practice">
      <div className="profile-section-heading"><Code2/><div><h2>HLD practice · System design questions</h2><p>Progress is connected to the published HLD question catalogue.</p></div></div>
      <div className="question-progress-summary">
        <article><strong>{questions.length}</strong><span>Available</span></article>
        <article><strong>{solved}</strong><span>Solved</span></article>
        <article><strong>{inProgress}</strong><span>In progress</span></article>
        <article><strong>{questions.length - solved - inProgress}</strong><span>Not started</span></article>
      </div>
      <div className="question-list-toolbar">
        <input aria-label="Search questions" placeholder="Search questions or categories…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <select aria-label="Filter question progress" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All questions</option><option value="solved">Solved</option><option value="in-progress">In progress</option><option value="not-started">Not started</option>
        </select>
      </div>
      <div className="profile-question-list">
        {visibleQuestions.map((q) => {
          const isSolved = q.progress?.status === 'SOLVED';
          const started = Boolean(q.progress);
          const learning = q.learning ?? {};
          const followups = learning.followUpQuestions ?? [];
          const refs = learning.referenceSolutions ?? [];
          const topics = learning.revisionRecommendations ?? [];
          return <article className="profile-question-card" key={q.id}>
            <div className="profile-question-top">
              <div><span className="profile-question-meta">{q.category} · {q.difficulty} · {q.estimatedMinutes ?? '—'} min</span><h3>{q.title}</h3>{q.subtitle && <p>{q.subtitle}</p>}</div>
              <span className={`profile-question-status ${isSolved ? 'is-solved' : started ? 'is-progress' : ''}`}>{isSolved ? <><CheckCircle2 size={13}/> Solved</> : started ? <><CircleDashed size={13}/> In progress</> : 'Not started'}</span>
            </div>
            {q.tags.length > 0 && <div className="profile-question-tags">{q.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
            <div className="profile-question-learning">
              {refs.length > 0 && <div><b>Reference solutions</b><ul>{refs.map((r) => <li key={r.id}>{r.name} <small>{r.difficulty ?? ''}</small></li>)}</ul></div>}
              {topics.length > 0 && <div><b>Reference topics ({topics.length})</b><ul>{topics.map((topic, index) => <li key={`${q.id}-topic-${index}`}>{topic.text} {topic.requirementIds?.length ? <small>· {topic.requirementIds.join(', ')}</small> : null}</li>)}</ul></div>}
              {followups.length > 0 && <div><b>Follow-up questions ({followups.length})</b><ul>{followups.map((f) => <li key={f.id}>{f.prompt} <small>{f.difficulty ?? ''}</small></li>)}</ul></div>}
            </div>
            <div className="profile-question-actions">
              {!started && <button disabled={actionId === q.id} onClick={() => void updateQuestion(q, 'start')}>Mark in progress</button>}
              {!isSolved && <button className="profile-solve-button" disabled={actionId === q.id} onClick={() => void updateQuestion(q, 'manual_solve')}>Mark solved</button>}
              {isSolved && <button disabled={actionId === q.id} onClick={() => void updateQuestion(q, 'reopen')}>Reopen</button>}
              {q.progress?.evaluatorPassed && <small className="profile-eval-note">Evaluator passed</small>}
              {q.progress?.manualSolved && <small className="profile-eval-note">Manually marked solved</small>}
            </div>
            <a className="profile-open-question" href={links.studio}>Open in Architecture Studio →</a>
          </article>;
        })}
        {visibleQuestions.length === 0 && <p className="profile-empty">No questions match this filter.</p>}
      </div>
    </section>
    {error && <p className="profile-error" role="alert">{error}</p>}
  </main>;
}
