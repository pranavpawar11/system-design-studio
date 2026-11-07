import Modal from '../ui/Modal';
import { question, learning, useStudio } from '../../features/architecture/architecture.store';
import { buildSummary } from '../../features/learning/summary';
import { reqTitle } from '../../features/questions/requirementGroups';

export default function SummaryModal({ onClose }: { onClose(): void }) {
  const { report, hints, answers, interview } = useStudio();
  const s = buildSummary({ report, titleOf: reqTitle, hintsUsed: hints.length, hintsTotal: question.hints.length, followUps: learning.followUpQuestions, answers, recommendations: learning.revisionRecommendations, interview });
  return (
    <Modal label="Learning summary" wide onClose={onClose}>
      <h2>Learning summary</h2>
      {!s.validated && <div className="callout"><b>Not validated yet</b><p>Click Validate first so this summary can show which requirements your design meets.</p></div>}
      <div className="sum-grid">
        <div><b>{s.validated ? `${s.met.length}/${s.total}` : '—'}</b><span>requirements met</span></div>
        <div><b>{s.hintsUsed}/{s.hintsTotal}</b><span>hints used</span></div>
        <div><b>{s.followUps.reviewed}/{s.followUps.total}</b><span>follow-ups reviewed</span></div>
      </div>
      <p className="muted">{s.independence}.{s.followUps.pointsTotal > 0 && ` You ticked ${s.followUps.pointsCovered} of ${s.followUps.pointsTotal} key points in the follow-ups you reviewed.`}</p>
      {s.interview && <div className="callout"><b>Interview session</b><p>{s.interview.minutesUsed} of {s.interview.durationMinutes} min used{s.interview.overtime ? ' (went over time)' : ''} · {s.interview.validations} validation{s.interview.validations === 1 ? '' : 's'} · hints were disabled.</p></div>}
      {s.met.length > 0 && <><h3>Going well</h3><ul>{s.met.map((m) => <li key={m}>{m}</li>)}</ul></>}
      {s.notMet.length > 0 && <><h3>Not met</h3><ul>{s.notMet.map((m) => <li key={m.title}><b>{m.title}</b>{m.next && <><br /><span className="muted">{m.next}</span></>}</li>)}</ul></>}
      {s.unverified.length > 0 && <><h3>Could not be verified from the diagram</h3><ul>{s.unverified.map((m) => <li key={m.title}><b>{m.title}</b>{m.next && <><br /><span className="muted">{m.next}</span></>}</li>)}</ul></>}
      {s.recommendations.length > 0 && <><h3>Worth revising</h3><ul>{s.recommendations.map((r) => <li key={r}>{r}</li>)}</ul></>}
      <div className="callout"><b>Next step</b><p>{s.nextStep}</p></div>
      <p className="muted">This summary shows counts and evidence only. There is no hidden score.</p>
      <div className="modal-actions"><button className="primary" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
