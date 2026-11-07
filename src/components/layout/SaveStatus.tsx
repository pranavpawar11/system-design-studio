import { api } from '../../api';
import { useStudio } from '../../features/architecture/architecture.store';

/** One calm indicator for all save states. Only a failure asks for attention. */
export default function SaveStatus() {
  const { dirty, saveState, save } = useStudio();
  const failed = saveState === 'failed';
  return (
    <span className={`status ${failed ? 'failed' : dirty || saveState === 'saving' ? 'pending' : 'ok'}`} role="status" aria-live="polite">
      {failed ? <>Save failed <button className="link" onClick={save}>Retry</button></>
        : saveState === 'saving' ? 'Saving…'
        : dirty ? 'Unsaved changes'
        : api.savedLabel}
    </span>
  );
}
