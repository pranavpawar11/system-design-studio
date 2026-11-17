import { useEffect } from 'react';
import './learn.css';
import { Layers } from 'lucide-react';
import type { Route } from '../../app/route';
import { useLearn } from '../../features/learning/learn.store';
import ModeNav from '../layout/ModeNav';
import LearnHome from './LearnHome';
import LessonPage from './LessonPage';

export default function LearnApp({ route }: { route: Exclude<Route, { name: 'studio' }> }) {
  const { status, error, load, notice, dismiss } = useLearn();
  useEffect(() => { if (status === 'idle') void load(); }, [status, load]);
  useEffect(() => { if (route.name === 'learn') document.title = 'Learn system design · HLD Studio'; }, [route]);
  useEffect(() => { if (!notice) return; const t = setTimeout(dismiss, 5000); return () => clearTimeout(t); }, [notice, dismiss]);
  return (
    <div className="app learn">
      <a className="skip" href="#learn-main">Skip to the content</a>
      <header className="topbar">
        <div className="bar-group"><h1 className="brand" translate="no"><Layers size={18} aria-hidden /> HLD Studio</h1><ModeNav current="learn" /></div>
      </header>
      <main id="learn-main" className="learn-main" tabIndex={-1}>
        {status === 'error' ? <div className="learn-wrap"><p role="alert" className="err">The roadmap could not be loaded: {error}</p><button className="primary" onClick={() => void load()}>Try again</button></div>
          : status !== 'ready' ? <div className="learn-wrap" aria-busy="true"><p role="status">Loading the roadmap…</p></div>
          : route.name === 'learn' ? <LearnHome /> : <LessonPage id={route.id} />}
      </main>
      <div className="toast-region" role="status" aria-live="polite">{notice && <div className="toast">{notice}</div>}</div>
    </div>
  );
}
