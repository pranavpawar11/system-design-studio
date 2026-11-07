import { StrictMode, useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';

/** Loads the app (and, through it, the question, draft and snapshots from the API) with visible loading and error states. */
function Boot() {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; App: ComponentType } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true; setState({ kind: 'loading' });
    import('./app/App').then((m) => live && setState({ kind: 'ready', App: m.default })).catch((e: Error) => live && setState({ kind: 'error', message: e.message }));
    return () => { live = false; };
  }, [attempt]);
  if (state.kind === 'ready') return <state.App />;
  return (
    <main className="boot" aria-busy={state.kind === 'loading'}>
      <h1 translate="no">HLD Studio</h1>
      {state.kind === 'loading' ? <p role="status">Loading your workspace…</p> : (
        <>
          <p role="alert">We couldn’t load your workspace. {state.message}</p>
          <button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<StrictMode><Boot /></StrictMode>);
