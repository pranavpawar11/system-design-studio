import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, Clock3, ListChecks } from 'lucide-react';
import { links } from '../../app/route';
import type { Lesson } from '../../features/learning/types';
import { PROGRAMMING_LANGUAGES, useProgrammingLanguage } from '../../features/learning/programming-language';
import { getLessonLanguageContent } from '../../features/learning/lesson-language';
import { getLLDLessonProgress, isLLDLessonComplete, markLLDLessonRead, markLLDQuizPassed } from '../../features/learning/lld-progress';
import objectLessonJson from '../../data/learning/lld/lessons/what-is-an-object.json';
import classLessonJson from '../../data/learning/lld/lessons/what-is-a-class.json';
import stateLessonJson from '../../data/learning/lld/lessons/state-behavior-and-identity.json';
import lifecycleLessonJson from '../../data/learning/lld/lessons/object-lifecycle.json';
import constructorLessonJson from '../../data/learning/lld/lessons/objects-and-classes-constructors-and-initialization.json';
import BlockView from './BlockView';
import QuizPanel from './QuizPanel';
import './lesson-experience.css';

type NavItem = { id: string; title: string };
const lessons = [objectLessonJson, classLessonJson, stateLessonJson, lifecycleLessonJson, constructorLessonJson] as unknown as Lesson[];
const orderedIds = lessons.map((lesson) => lesson.id);

export default function LLDLessonPage({ id }: { id: string }) {
  const lesson = useMemo(() => lessons.find((item) => item.id === id), [id]);
  const language = useProgrammingLanguage();
  const languageMeta = PROGRAMMING_LANGUAGES.find((item) => item.id === language)!;
  const content = lesson ? getLessonLanguageContent(lesson, language) : undefined;
  const [progress, setProgress] = useState(() => getLLDLessonProgress(id));
  const [activeSection, setActiveSection] = useState('lld-lesson-overview');
  useEffect(() => { setProgress(getLLDLessonProgress(id)); setActiveSection('lld-lesson-overview'); }, [id]);
  const index = orderedIds.indexOf(id);
  const nextId = index >= 0 ? orderedIds[index + 1] : undefined;
  const nextLesson = nextId ? lessons.find((item) => item.id === nextId) : undefined;

  if (!lesson) {
    return <div className="learn-wrap lesson lesson-page"><nav className="lesson-breadcrumbs"><a href={links.lldLearn}><ArrowLeft size={14}/> Back to LLD roadmap</a></nav><h1>Lesson not found</h1><p>This LLD lesson could not be loaded. Return to the roadmap and choose an available lesson.</p></div>;
  }

  const lessonBlocks = content?.blocks ?? lesson.blocks;
  const headings = lessonBlocks.flatMap((block, i) => block.type === 'heading' ? [{ id: `lld-lesson-section-${i}`, title: block.text }] : []);
  const navItems: NavItem[] = [{ id: 'lld-lesson-overview', title: 'Overview' }, ...headings, ...(lesson.quiz ? [{ id: 'lld-lesson-quiz', title: 'Knowledge check' }] : [])];
  const complete = isLLDLessonComplete(progress);
  const completion = complete ? 100 : (progress.read || progress.quizPassed ? 50 : 0);

  const jumpTo = (item: NavItem) => {
    const target = document.getElementById(item.id);
    if (!target) return;
    setActiveSection(item.id);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <article className="learn-wrap lesson lesson-page lld-lesson-page">
      <nav className="lesson-breadcrumbs" aria-label="Breadcrumb">
        <a href={links.lldLearn}><ArrowLeft size={14}/> Back to roadmap</a><span>/</span><span>Level 01 · Object-Oriented Programming Fundamentals</span>
      </nav>
      <header className="lesson-hero" id="lld-lesson-overview">
        <div className="lesson-hero-copy">
          <div className="lesson-kicker"><span>LLD LEARNING PATH</span><span className="lesson-kicker-dot"/>{languageMeta.label} implementation</div>
          <h1>{lesson.title}</h1>
          <p className="lesson-summary">{content?.summary ?? lesson.summary}</p>
          <div className="lesson-facts">
            <span><Clock3 size={14}/> {lesson.minutes} min</span><span><BookOpen size={14}/> Reading</span>
            {lesson.quiz && <span><ListChecks size={14}/> Knowledge check</span>}
            {progress.read && <span className="lesson-complete"><CheckCircle2 size={14}/> Read</span>}
            {progress.quizPassed && <span className="lesson-complete"><CheckCircle2 size={14}/> Quiz passed</span>}
          </div>
        </div>
        <div className="lesson-progress-card">
          <div className="lesson-progress-top"><span>Your progress</span><b>{completion}%</b></div>
          <div className="lesson-progress-track"><span style={{ width: `${completion}%` }}/></div>
          <p>{complete ? 'Lesson completed. Your reading and quiz progress is saved.' : 'Read the lesson and pass the knowledge check to complete it.'}</p>
          <div className="lesson-progress-links"><span>{progress.read ? <CheckCircle2 size={13}/> : <BookOpen size={13}/>} Read</span>{lesson.quiz && <span>{progress.quizPassed ? <CheckCircle2 size={13}/> : <ListChecks size={13}/>} Check</span>}</div>
        </div>
      </header>
      <div className="lesson-layout">
        <aside className="lesson-rail" aria-label="Lesson navigation">
          <div className="lesson-rail-title">IN THIS LESSON</div>
          <nav aria-label="Jump to a lesson section">
            {navItems.map((item) => <a key={item.id} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); jumpTo(item); }} className={activeSection === item.id ? 'active' : ''} aria-current={activeSection === item.id ? 'location' : undefined}>
              {item.id === 'lld-lesson-quiz' ? <ListChecks size={14}/> : <Circle size={12}/>}<span>{item.title}</span>
            </a>)}
          </nav>
          <div className="lesson-rail-tip"><b>Learning tip</b><p>Read each {languageMeta.label} example and predict what the code will do before moving to the next section.</p></div>
        </aside>
        <div className="lesson-main-column">
          <section className="lesson-reading" aria-label="Lesson content">
            <div className="lesson-section-label"><BookOpen size={15}/> THE CONCEPT</div>
            {lessonBlocks.map((block, i) => <BlockView key={`${lesson.id}-${i}`} block={block} headingId={block.type === 'heading' ? `lld-lesson-section-${i}` : undefined}/>)}
            {content?.implementationNotes.length ? <div className="lesson-implementation-notes"><div className="lesson-section-label">{languageMeta.label.toUpperCase()} IMPLEMENTATION NOTES</div>{content.implementationNotes.map((block, i) => <BlockView key={`${lesson.id}-${language}-note-${i}`} block={block}/>)}</div> : null}
            <button className="primary lesson-mark-read" type="button" onClick={() => setProgress(markLLDLessonRead(id))} disabled={progress.read}>
              <CheckCircle2 size={16}/> {progress.read ? 'Marked as read' : 'Mark lesson as read'}
            </button>
            {progress.read && <p className="lesson-read-confirmation" role="status">Your reading progress has been saved.</p>}
          </section>
          {lesson.quiz && <div id="lld-lesson-quiz" className="lesson-interactive-section"><div className="lesson-section-label"><ListChecks size={15}/> TEST YOUR UNDERSTANDING</div>
            <QuizPanel key={lesson.id} quiz={lesson.quiz} passed={progress.quizPassed} onPass={() => setProgress(markLLDQuizPassed(id))}/>
          </div>}
          {complete && <div className="callout done-banner lesson-done-banner" role="status"><CheckCircle2 size={18}/><div><b>Lesson complete</b><p>Your progress is saved. Continue to the next lesson when you're ready.</p></div></div>}
          <footer className="lesson-footer-nav"><a href={links.lldLearn}><ArrowLeft size={14}/> All LLD lessons</a>{nextLesson && <a className="lesson-next" href={links.lldLesson(nextLesson.id)}>Next lesson <ArrowRight size={14}/> </a>}</footer>
        </div>
      </div>
    </article>
  );
}
