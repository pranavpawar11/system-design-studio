import './learn.css';
import { useEffect, useLayoutEffect } from 'react';
import { Layers } from 'lucide-react';
import { links, type Route } from '../../app/route';
import { useLearn } from '../../features/learning/learn.store';
import { setProgrammingLanguage, useProgrammingLanguage } from '../../features/learning/programming-language';

import LearnHome from './LearnHome';
import LLDHome from './LLDHome';

import ProgrammingLanguageSwitcher from './ProgrammingLanguageSwitcher';
import LessonPage from './LessonPage';
import LLDLessonPage from './LLDLessonPage';

type LearningRoute = Extract<Route, { name: 'learn' | 'lesson' | 'lld' | 'lld-lesson' }>;

export default function LearnApp({ route }: { route: LearningRoute }) {
  const { status, errorCode, load, notice, dismiss } = useLearn();
  const programmingLanguage = useProgrammingLanguage();
  const usesHld = route.name === 'learn' || route.name === 'lesson';
  const routeKey = 'id' in route ? `${route.name}:${route.id}` : route.name;

  // Learn uses .learn-main as its own scroll container. Reset it synchronously
  // after every route change so Next, Back, and browser history always start at top.
  useLayoutEffect(() => {
    const main = document.getElementById('learn-main');
    if (main) {
      main.scrollTop = 0;
      main.scrollLeft = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [routeKey]);

  useEffect(() => { if (usesHld && status === 'idle') void load(); }, [usesHld, status, load]);
  useEffect(() => { document.title = route.name === 'lld' || route.name === 'lld-lesson' ? 'Learn low-level design · HLD Studio' : 'Learn system design · HLD Studio'; }, [route]);
  useEffect(() => { if (!notice) return; const t = setTimeout(dismiss, 5000); return () => clearTimeout(t); }, [notice, dismiss]);
  return (
    <div className="app learn">
      <a className="skip" href="#learn-main">Skip to the content</a>
      <header className="topbar learn-topbar">
        <div className="bar-group"><a className="brand learn-brand-link" href={links.home} translate="no"><Layers size={18} aria-hidden /> HLD Studio</a></div>
        <div className="learn-header-controls">
          {usesHld
            ? <a className="learn-context-link" href={links.studio}>Open Studio <span aria-hidden>↗</span></a>
            : <ProgrammingLanguageSwitcher value={programmingLanguage} onChange={setProgrammingLanguage} />}
        </div>
      </header>
      <main id="learn-main" className="learn-main" tabIndex={-1}>
        {route.name === 'lld' ? <LLDHome /> : route.name === 'lld-lesson' ? <LLDLessonPage key={route.id} id={route.id} /> : status === 'error' ? (
          <div className="learn-wrap">
            {errorCode === 'PUBLISHED_ROADMAP_NOT_FOUND' ? (
              <section className="roadmap-empty" role="status">
                <Layers size={24} aria-hidden />
                <b>The HLD learning path is not published yet</b>
                <span>The curriculum is being prepared. It will appear here once it has been reviewed and published.</span>
                <button className="primary" onClick={() => void load()}>Check again</button>
              </section>
            ) : (
              <section className="roadmap-empty" role="alert">
                <b>We couldn’t load the learning path</b>
                <span>Please check your connection and try again. Your learning progress is safe.</span>
                <button className="primary" onClick={() => void load()}>Try again</button>
              </section>
            )}
          </div>
        ) : status !== 'ready' ? <div className="learn-wrap" aria-busy="true"><p role="status">Loading the roadmap…</p></div>
          : route.name === 'learn' ? <LearnHome /> : <LessonPage key={route.id} id={route.id} />}
      </main>
      <div className="toast-region" role="status" aria-live="polite">{notice && <div className="toast">{notice}</div>}</div>
    </div>
  );
}
