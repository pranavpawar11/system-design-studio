import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, CircleAlert, Eye, LoaderCircle, RefreshCw, Search, Send, ShieldCheck, X, Pencil } from 'lucide-react';
import { adminApi, type LearningContentStatus, type LearningDashboard, type LearningLessonVersion, type LearningReviewItem, type LearningVersionDetail } from './adminApi';
import LearningLessonEditor from './LearningLessonEditor';
import LearningRoadmapAdmin from './LearningRoadmapAdmin';
import LearningPracticeCatalogueAdmin from './LearningPracticeCatalogueAdmin';
import './learning-admin.css';

type Props = { token: string; can: (permission: string) => boolean };
const statuses: LearningContentStatus[] = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED'];
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const date = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

export default function LearningAdminPanel({ token, can }: Props) {
  const [dashboard, setDashboard] = useState<LearningDashboard | null>(null);
  const [items, setItems] = useState<LearningLessonVersion[]>([]);
  const [reviews, setReviews] = useState<LearningReviewItem[]>([]);
  const [approved, setApproved] = useState<LearningLessonVersion[]>([]);
  const [track, setTrack] = useState('');
  const [status, setStatus] = useState<LearningContentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detail, setDetail] = useState<LearningVersionDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectText, setRejectText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<'catalogue' | 'reviews' | 'roadmaps' | 'practice'>('catalogue');

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const tasks: Promise<unknown>[] = [
        adminApi.getLearningDashboard(token).then(setDashboard),
        adminApi.listLearningLessons(token, { page, pageSize: 20, track: track || undefined, status: status || undefined, search: appliedSearch || undefined }).then((result) => {
          setItems(result.items); setTotalPages(Math.max(1, result.pagination.totalPages));
        }),
      ];
      if (can('learning.review')) tasks.push(adminApi.listLearningReviews(token, { page: 1, pageSize: 100, track: track || undefined, search: appliedSearch || undefined }).then((r) => setReviews(r.items)));
      if (can('learning.publish')) tasks.push(adminApi.listLearningLessons(token, { page: 1, pageSize: 100, track: track || undefined, status: 'APPROVED' }).then((r) => setApproved(r.items)));
      await Promise.all(tasks);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [token, can, page, track, status, appliedSearch]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(message); await load(); if (detail) { const updated = await adminApi.getLearningLesson(token, detail.id); setDetail(updated.version); } }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const openDetail = async (id: string) => {
    setBusy(true); setError('');
    try { const result = await adminApi.getLearningLesson(token, id); setDetail(result.version); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const submitSearch = () => { setPage(1); setAppliedSearch(search.trim()); };

  return <section className="learning-admin">
    {error && <div className="admin-alert error"><CircleAlert size={17}/>{error}<button onClick={() => setError('')}><X size={15}/></button></div>}
    {notice && <div className="admin-alert success"><Check size={17}/>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
    <div className="learning-admin-heading">
      <div><h2>Learning content</h2><p>Manage imported HLD and LLD lessons through review and publication.</p></div>
      <button className="admin-icon-button" onClick={() => void load()} disabled={busy} title="Refresh learning data"><RefreshCw size={16}/></button>
    </div>
    {busy && <div className="admin-loading-line"><LoaderCircle size={15}/> Loading learning workspace…</div>}
    {dashboard && <div className="learning-admin-stats">
      <div><span>Tracks</span><strong>{dashboard.tracks.length}</strong><small>{dashboard.tracks.map((t) => t.key.toUpperCase()).join(' · ')}</small></div>
      <div><span>Lessons</span><strong>{Object.values(dashboard.lessons).reduce((a, b) => a + (b ?? 0), 0)}</strong><small>{dashboard.lessons.DRAFT ?? 0} drafts · {dashboard.lessons.PUBLISHED ?? 0} published</small></div>
      <div><span>In review</span><strong>{dashboard.lessons.IN_REVIEW ?? 0}</strong><small>Awaiting reviewer decision</small></div>
      <div><span>Published roadmaps</span><strong>{dashboard.roadmaps.PUBLISHED ?? 0}</strong><small>{dashboard.roadmaps.DRAFT ?? 0} drafts available</small></div>
    </div>}
    <div className="learning-admin-tabs">
      <button className={section === 'catalogue' ? 'active' : ''} onClick={() => setSection('catalogue')}><BookOpen size={15}/> Lesson catalogue</button>
      {can('learning.review') && <button className={section === 'reviews' ? 'active' : ''} onClick={() => setSection('reviews')}><ShieldCheck size={15}/> Review queue <b>{reviews.length}</b></button>}
      <button className={section === 'roadmaps' ? 'active' : ''} onClick={() => setSection('roadmaps')}><BookOpen size={15}/> Roadmaps</button>
      <button className={section === 'practice' ? 'active' : ''} onClick={() => setSection('practice')}><BookOpen size={15}/> Practice catalogues</button>
    </div>
    {section === 'catalogue' && <>
      <div className="admin-toolbar learning-admin-toolbar">
        <label className="admin-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }} placeholder="Search lesson title or key"/></label>
        <select aria-label="Filter learning track" value={track} onChange={(e) => { setTrack(e.target.value); setPage(1); }}><option value="">All tracks</option><option value="hld">HLD</option><option value="lld">LLD</option></select>
        <select aria-label="Filter lesson status" value={status} onChange={(e) => { setStatus(e.target.value as LearningContentStatus | ''); setPage(1); }}><option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <button className="admin-secondary-button" onClick={submitSearch}>Search</button>
      </div>
      <div className="admin-table-wrap"><table className="admin-table learning-admin-table"><thead><tr><th>Lesson</th><th>Track</th><th>Version</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><small>{item.lesson.lessonKey}</small></td><td>{item.lesson.track.key.toUpperCase()}</td><td>v{item.version}</td><td><span className={`learning-status ${item.status.toLowerCase()}`}>{label(item.status)}</span></td><td>{date(item.updatedAt)}</td><td className="learning-actions"><button className="admin-secondary-button" onClick={() => void openDetail(item.id)}><Eye size={14}/> View</button>{(item.status === 'DRAFT' || item.status === 'REJECTED') && can('learning.submit') && <button className="admin-primary-button" disabled={busy} onClick={() => void runAction(() => adminApi.submitLearningLesson(token, item.id), 'Lesson submitted for review.') }><Send size={14}/> Submit</button>}{item.status === 'APPROVED' && can('learning.publish') && <button className="admin-primary-button" disabled={busy} onClick={() => void runAction(() => adminApi.publishLearningLesson(token, item.id), 'Lesson published.')}>Publish</button>}</td></tr>)}
        {items.length === 0 && <tr><td colSpan={6} className="admin-table-empty">No learning lessons match these filters.</td></tr>}
      </tbody></table></div>
      <div className="learning-pagination"><span>Page {page} of {totalPages}</span><div><button className="admin-secondary-button" disabled={page <= 1 || busy} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="admin-secondary-button" disabled={page >= totalPages || busy} onClick={() => setPage((p) => p + 1)}>Next</button></div></div>
      {can('learning.publish') && <div className="learning-approved-list"><div className="admin-panel-heading"><div><h3>Approved · ready to publish</h3><p>{approved.length} approved lesson(s) in the current track</p></div></div>{approved.map((item) => <div className="learning-approved-row" key={item.id}><div><strong>{item.title}</strong><small>{item.lesson.track.key.toUpperCase()} · {item.lesson.lessonKey} · v{item.version}</small></div><button className="admin-primary-button" disabled={busy} onClick={() => void runAction(() => adminApi.publishLearningLesson(token, item.id), 'Lesson published.')}>Publish</button></div>)}{approved.length === 0 && <p className="learning-muted">No approved lessons are waiting to be published.</p>}</div>}
    </>}
    {section === 'roadmaps' && <LearningRoadmapAdmin token={token} can={can}/>}
    {section === 'practice' && <LearningPracticeCatalogueAdmin token={token} can={can}/>}
    {section === 'reviews' && <div className="learning-review-list">{reviews.map((item) => <article className="learning-review-card" key={item.id}><div><div className="learning-review-meta">{item.lesson.track.key.toUpperCase()} · {item.lesson.lessonKey} · v{item.version}</div><h3>{item.title}</h3><p>{item.summary}</p><small>Submitted by {item.creator?.name ?? 'Unknown'} · {date(item.submittedAt)}</small></div><div className="learning-review-actions"><button className="admin-secondary-button" onClick={() => void openDetail(item.id)}>View content</button>{can('learning.approve') && <><button className="admin-approve-button" disabled={busy} onClick={() => void runAction(() => adminApi.approveLearningLesson(token, item.id), 'Lesson approved.') }><Check size={14}/> Approve</button><button className="admin-reject-button" disabled={busy} onClick={() => { setRejecting(item.id); setRejectText(''); }}>Reject</button></>}</div>{rejecting === item.id && <form className="learning-reject-form" onSubmit={(e) => { e.preventDefault(); void runAction(() => adminApi.rejectLearningLesson(token, item.id, rejectText), 'Lesson rejected.'); setRejecting(null); }}><textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} minLength={3} required placeholder="Explain what needs to change (at least 3 characters)"/><div><button type="button" className="admin-secondary-button" onClick={() => setRejecting(null)}>Cancel</button><button className="admin-reject-button" type="submit">Confirm rejection</button></div></form>}</article>)}{reviews.length === 0 && <div className="admin-empty"><Check size={22}/><strong>Review queue is clear</strong><span>No learning lessons are waiting for review.</span></div>}</div>}
    {detail && <div className="admin-modal-backdrop learning-detail-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}><section className="learning-detail-modal" role="dialog" aria-modal="true" aria-label="Learning lesson details"><header><div><span>{detail.lesson.track.key.toUpperCase()} · {detail.lesson.lessonKey} · VERSION {detail.version}</span><h2>{detail.title}</h2><p>{detail.summary}</p></div><button type="button" onClick={() => setDetail(null)} aria-label="Close details"><X size={18}/></button></header><div className="learning-detail-meta"><span className={`learning-status ${detail.status.toLowerCase()}`}>{label(detail.status)}</span><span>{detail.minutes} min</span><span>Updated {date(detail.updatedAt)}</span><span>Author: {detail.creator?.name ?? 'Imported content'}</span></div><div className="learning-detail-content"><h3>Lesson JSON content</h3><pre>{JSON.stringify(detail.content, null, 2)}</pre></div>{detail.reviews.length > 0 && <div className="learning-detail-reviews"><h3>Review history</h3>{detail.reviews.map((review) => <div key={review.id}><strong>{label(review.decision)} · {review.reviewer.name}</strong><small>{date(review.createdAt)}</small>{review.comments && <p>{review.comments}</p>}</div>)}</div>}<footer>{(detail.status === 'DRAFT' || detail.status === 'REJECTED') && can('learning.manage') && <button className="admin-secondary-button" onClick={() => setEditing(true)}><Pencil size={14}/> Edit lesson</button>}{(detail.status === 'DRAFT' || detail.status === 'REJECTED') && can('learning.submit') && <button className="admin-primary-button" onClick={() => void runAction(() => adminApi.submitLearningLesson(token, detail.id), 'Lesson submitted for review.')}>Submit for review</button>}{detail.status === 'IN_REVIEW' && can('learning.approve') && <button className="admin-approve-button" onClick={() => void runAction(() => adminApi.approveLearningLesson(token, detail.id), 'Lesson approved.')}>Approve</button>}{detail.status === 'APPROVED' && can('learning.publish') && <button className="admin-primary-button" onClick={() => void runAction(() => adminApi.publishLearningLesson(token, detail.id), 'Lesson published.')}>Publish lesson</button>}</footer></section></div>}
    {editing && detail && <LearningLessonEditor lesson={detail} saving={busy} onClose={() => setEditing(false)} onSave={async (input) => {
      setBusy(true); setError(''); setNotice('');
      try { await adminApi.updateLearningLessonDraft(token, detail.id, input); const updated = await adminApi.getLearningLesson(token, detail.id); setDetail(updated.version); setEditing(false); setNotice('Lesson draft saved successfully.'); await load(); }
      catch (e) { setError((e as Error).message); throw e; }
      finally { setBusy(false); }
    }} />}
  </section>;
}
