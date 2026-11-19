import { useEffect, useState } from 'react';
import './lesson-experience.css';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, Clock3, FlaskConical, ListChecks, Target } from 'lucide-react';
import type { Lesson } from '../../api';
import { learningContentApi, LearningApiError } from '../../api/learning/LearningContentApi';
import { links } from '../../app/route';
import { switchQuestion } from '../../api/preferences';
import { question } from '../../features/architecture/architecture.store';
import { useLearn, useProgress } from '../../features/learning/learn.store';
import { isLessonDone, leaves, pathTo } from '../../features/learning/progress';
import BlockView from './BlockView';
import LabPanel from './LabPanel';
import QuizPanel from './QuizPanel';

type NavItem = { id: string; title: string; icon: 'book' | 'lab' | 'quiz' | 'target' };

export default function LessonPage({ id }: { id: string }) {
  const { roadmap, events, record } = useLearn(); const progress = useProgress();
  const node = roadmap && leaves(roadmap.nodes).find((n) => n.id === id);
  const trail = roadmap ? pathTo(roadmap.nodes, id) : null;
  const [s, setS] = useState<{ status: 'loading' | 'ready' | 'error'; lesson?: Lesson; error?: Error }>({ status: 'loading' });
  const [activeSection, setActiveSection] = useState('lesson-overview');
  useEffect(() => {
    if (!node || node.status !== 'ready') return;
    let live = true; setS({ status: 'loading' });
    learningContentApi.getLesson('hld', id).then((lesson) => { if (live) { setS({ status: 'ready', lesson }); document.title = `${lesson.title} · HLD Studio`; void record(id, 'lesson_viewed'); } })
      .catch((e: Error) => live && setS({ status: 'error', error: e }));
    return () => { live = false; };
  }, [id, node?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const root = document.querySelector('.lesson-page');
    if (!root || !('IntersectionObserver' in window)) return;
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[id="lesson-overview"], [id^="lesson-section-"], [id="lesson-lab"], [id="lesson-quiz"], [id="lesson-practice"]'));
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { root: document.querySelector('.learn-main'), rootMargin: '-18% 0px -68% 0px', threshold: 0 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [id, s.status]);

  const back = <a href={links.learn}><ArrowLeft size={14} /> Back to roadmap</a>;
  if (!node) return <div className="learn-wrap"><h2>Lesson not found</h2><p>There is no lesson called “{id}”.</p>{back}</div>;
  if (node.status !== 'ready') return <div className="learn-wrap"><nav className="crumbs" aria-label="Breadcrumb">{back}</nav><h2>{node.title}</h2><div className="callout"><b>Not written yet</b><p>This lesson is on the map but has not been written. Nothing is lost: the lessons around it are open.</p></div></div>;
  if (s.status === 'error') {
    const unavailable = s.error instanceof LearningApiError && s.error.statusCode === 404;
    return <div className="learn-wrap">
      <nav className="crumbs" aria-label="Breadcrumb">{back}</nav>
      <section className="roadmap-empty" role={unavailable ? 'status' : 'alert'}>
        <BookOpen size={24} aria-hidden />
        <b>{unavailable ? 'This lesson is not available yet' : 'We couldn’t load this lesson'}</b>
        <span>{unavailable
          ? 'This topic is part of the learning path, but its lesson content is not currently published.'
          : 'Please check your connection and try again. Your progress is safe.'}</span>
        {!unavailable && <button className="primary" onClick={() => {
          setS({ status: 'loading' });
          learningContentApi.getLesson('hld', id)
            .then((lesson) => { setS({ status: 'ready', lesson }); document.title = `${lesson.title} · HLD Studio`; })
            .catch((error: Error) => setS({ status: 'error', error }));
        }}>Try again</button>}
      </section>
    </div>;
  }
  if (s.status === 'loading' || !s.lesson) return <div className="learn-wrap" aria-busy="true"><p role="status">Loading the lesson…</p></div>;

  const lesson = s.lesson;
  const has = (t: string) => events.some((e) => e.nodeId === id && e.type === t);
  const done = isLessonDone(node, events);
  const next = progress?.nextUp && progress.nextUp.id !== id ? progress.nextUp : null;
  const practise = (qid: string) => { window.location.hash = links.studio; if (qid !== question.question.id) switchQuestion(qid); };
  const headings = lesson.blocks.flatMap((block, index) => block.type === 'heading' ? [{ id: `lesson-section-${index}`, title: block.text }] : []);
  const navItems: NavItem[] = [
    { id: 'lesson-overview', title: 'Overview', icon: 'book' },
    ...headings.map((h) => ({ ...h, icon: 'book' as const })),
    ...(lesson.lab ? [{ id: 'lesson-lab', title: 'Interactive lab', icon: 'lab' as const }] : []),
    ...(lesson.quiz ? [{ id: 'lesson-quiz', title: 'Knowledge check', icon: 'quiz' as const }] : []),
    ...(lesson.practice?.length ? [{ id: 'lesson-practice', title: 'Apply in Studio', icon: 'target' as const }] : []),
  ];
  const completedParts = Number(has('lab_completed')) + Number(has('quiz_passed'));
  const totalParts = Number(Boolean(lesson.lab)) + Number(Boolean(lesson.quiz));
  const completion = done ? 100 : Math.min(94, Math.round((completedParts / Math.max(1, totalParts)) * 100));


  return (
    <article className="learn-wrap lesson lesson-page">
      <nav className="lesson-breadcrumbs" aria-label="Breadcrumb">{back}<span>/</span><span>{trail?.slice(0, -1).map((n) => n.title).join(' / ')}</span></nav>
      <header className="lesson-hero" id="lesson-overview">
        <div className="lesson-hero-copy">
          <div className="lesson-kicker"><span>LEARNING PATH</span><span className="lesson-kicker-dot" />{trail?.slice(0, -1).at(-1)?.title ?? 'System design'}</div>
          <h1>{lesson.title}</h1>
          <p className="lesson-summary">{lesson.summary}</p>
          <div className="lesson-facts">
            <span><Clock3 size={14} /> {lesson.minutes} min</span>
            {lesson.lab && <span><FlaskConical size={14} /> Hands-on lab</span>}
            {lesson.quiz && <span><ListChecks size={14} /> Knowledge check</span>}
            {done && <span className="lesson-complete"><CheckCircle2 size={14} /> Completed</span>}
          </div>
        </div>
        <div className="lesson-progress-card">
          <div className="lesson-progress-top"><span>Your progress</span><b>{completion}%</b></div>
          <div className="lesson-progress-track"><span style={{ width: `${completion}%` }} /></div>
          <p>{done ? 'You have completed this lesson.' : 'Work through the sections, try the lab, and check your understanding.'}</p>
          <div className="lesson-progress-links"><span><BookOpen size={13} /> Read</span>{lesson.lab && <span><FlaskConical size={13} /> Experiment</span>}{lesson.quiz && <span><ListChecks size={13} /> Check</span>}</div>
        </div>
      </header>

      <div className="lesson-layout">
        <aside className="lesson-rail" aria-label="Lesson navigation">
          <div className="lesson-rail-title">IN THIS LESSON</div>
          <nav aria-label="Jump to a lesson section">{navItems.map((item) => <a key={item.id} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); const target = document.getElementById(item.id); if (target) { setActiveSection(item.id); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }} className={activeSection === item.id ? 'active' : ''} aria-current={activeSection === item.id ? 'location' : undefined}>{item.icon === 'lab' ? <FlaskConical size={14} /> : item.icon === 'quiz' ? <ListChecks size={14} /> : item.icon === 'target' ? <Target size={14} /> : <Circle size={12} />}<span>{item.title}</span></a>)}</nav>
          <div className="lesson-rail-tip"><b>Learning tip</b><p>Try to predict what will happen before changing a control in the lab.</p></div>
        </aside>

        <div className="lesson-main-column">
          <section className="lesson-reading" aria-label="Lesson content">
            <div className="lesson-section-label"><BookOpen size={15} /> THE CONCEPT</div>
            {lesson.blocks.map((b, i) => <BlockView key={i} block={b} headingId={b.type === 'heading' ? `lesson-section-${i}` : undefined} />)}
            {!lesson.lab && !lesson.quiz && !has('lesson_read') && <button className="primary lesson-mark-read" onClick={() => void record(id, 'lesson_read')}><CheckCircle2 size={16} /> Mark lesson as read</button>}
          </section>

          {lesson.lab && <div id="lesson-lab" className="lesson-interactive-section"><div className="lesson-section-label"><FlaskConical size={15} /> EXPERIMENT</div><LabPanel lab={lesson.lab} completed={has('lab_completed')} onComplete={() => void record(id, 'lab_completed')} /></div>}
          {lesson.quiz && <div id="lesson-quiz" className="lesson-interactive-section"><div className="lesson-section-label"><ListChecks size={15} /> TEST YOUR UNDERSTANDING</div><QuizPanel quiz={lesson.quiz} passed={has('quiz_passed')} onPass={(score) => void record(id, 'quiz_passed', score)} /></div>}

          {lesson.practice && lesson.practice.length > 0 && (
            <section id="lesson-practice" className="lesson-practice-card"><div className="lesson-section-label"><Target size={15} /> PUT IT INTO PRACTICE</div><h3>Take this concept into the Studio</h3><p>Apply what you have learned to a real system design problem.</p>
              <div className="practice">{lesson.practice.map((p) => <button key={p.questionId} onClick={() => practise(p.questionId)}>{p.label}<ArrowRight size={14} /></button>)}</div>
            </section>
          )}

          {done && <div className="callout done-banner lesson-done-banner" role="status"><CheckCircle2 size={18} /><div><b>Lesson complete</b><p>{next ? <>Continue your learning path with <a href={links.lesson(next.id)}>{next.title}</a>.</> : 'You have finished every lesson available so far. More are on the way.'}</p></div></div>}
          <footer className="lesson-footer-nav"><a href={links.learn}><ArrowLeft size={14} /> All lessons</a>{next && <a className="lesson-next" href={links.lesson(next.id)}>Next lesson <ArrowRight size={14} /></a>}</footer>
        </div>
      </div>
    </article>
  );
}
