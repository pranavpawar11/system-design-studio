import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, BookOpen, Check, ChevronRight, CircleAlert, FileCheck2, LoaderCircle, LogOut, Plus, RefreshCw, Search, Shield, ShieldCheck, Users, X, FileUp, GraduationCap } from 'lucide-react';
import { adminApi, type AdminAccount, type AuditEntry, type CatalogueVersion, type QuestionVersionStatus, type ReviewItem } from './adminApi';
import type { AdminRole } from '../auth/authApi';
import { useAuthStore } from '../auth/authStore';
import QuestionDraftEditor from './QuestionDraftEditor';
import QuestionImportPanel from './QuestionImportPanel';
import LearningAdminPanel from './LearningAdminPanel';
import './admin.css';

type Tab = 'overview' | 'users' | 'catalogue' | 'reviews' | 'audit' | 'import' | 'learning';
const roles: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'REVIEWER'];
const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const date = (value: string | null) => value ? new Date(value).toLocaleString() : 'Never';

export default function AdminConsole() {
  const user = useAuthStore((s) => s.adminUser);
  const token = useAuthStore((s) => s.adminToken);
  const logout = useAuthStore((s) => s.adminLogout);
  const can = useAuthStore((s) => s.hasAdminPermission);
  const [tab, setTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<AdminAccount[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueVersion[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueStatus, setCatalogueStatus] = useState<QuestionVersionStatus | ''>('');
  const [approved, setApproved] = useState<ReviewItem[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null | undefined>(undefined);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'EDITOR' as AdminRole });
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectText, setRejectText] = useState('');
  const [auditAction, setAuditAction] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true); setError('');
    try {
      const tasks: Promise<unknown>[] = [];
      if (can('admin.users.read')) tasks.push(adminApi.listUsers(token, { page: 1, pageSize: 100, search }).then((r) => setUsers(r.items)));
      if (can('questions.read')) tasks.push(adminApi.listCatalogue(token, { page: 1, pageSize: 100, search: catalogueSearch, status: catalogueStatus || undefined }).then((r) => setCatalogue(r.items)));
      if (can('questions.review')) tasks.push(adminApi.listReviews(token, 1, 100).then((r) => setReviews(r.items)));
      if (can('questions.publish')) tasks.push(adminApi.listApproved(token, 1, 100).then((r) => setApproved(r.items))); 
      if (can('audit.logs.read')) tasks.push(adminApi.listAudit(token, { page: 1, pageSize: 100, action: auditAction }).then((r) => setAudit(r.items)));
      await Promise.all(tasks);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [token, can, search, auditAction, catalogueSearch, catalogueStatus]);

  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(message); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault(); if (!token) return;
    await act(() => adminApi.createUser(token, newUser), 'Administrator account created.');
    setShowCreate(false); setNewUser({ name: '', email: '', password: '', role: 'EDITOR' });
  };
  const signOut = async () => { await logout(); window.location.hash = '#/admin/login'; };
  const nav: { id: Tab; label: string; icon: typeof Shield; allowed: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: Activity, allowed: true },
    { id: 'users', label: 'Administrators', icon: Users, allowed: can('admin.users.read') },
    { id: 'catalogue', label: 'Question catalogue', icon: BookOpen, allowed: can('questions.read') },
    { id: 'import', label: 'Import questions', icon: FileUp, allowed: can('questions.import') },
    { id: 'learning', label: 'Learning content', icon: GraduationCap, allowed: can('learning.read') },
    { id: 'reviews', label: 'Content reviews', icon: FileCheck2, allowed: can('questions.review') },
    { id: 'audit', label: 'Audit log', icon: ShieldCheck, allowed: can('audit.logs.read') },
  ];
  const activeReviews = reviews.length;
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="#/"><span className="admin-brand-icon"><ShieldCheck size={20}/></span><span>System Design Studio<small>ADMIN CONSOLE</small></span></a>
      <div className="admin-nav-label">WORKSPACE</div>
      <nav>{nav.filter((item) => item.allowed).map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><item.icon size={17}/>{item.label}{item.id === 'reviews' && activeReviews > 0 && <b className="admin-nav-count">{activeReviews}</b>}</button>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-profile"><span>{user?.name.slice(0, 1).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{pretty(user?.role ?? '')}</small></div></div><button className="admin-signout" onClick={() => void signOut()}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span className="admin-breadcrumb">Administration</span><span className="admin-breadcrumb-sep">/</span><strong>{nav.find((n) => n.id === tab)?.label}</strong></div><div className="admin-top-actions"><span className="admin-session"><i/> Secure session</span><button className="admin-icon-button" title="Refresh data" onClick={() => void load()} disabled={busy}><RefreshCw size={17}/></button></div></header>
      <div className="admin-content">
        <div className="admin-page-heading"><div><div className="admin-eyebrow">PLATFORM OPERATIONS</div><h1>{tab === 'overview' ? `Welcome, ${user?.name.split(' ')[0]}` : nav.find((n) => n.id === tab)?.label}</h1><p>{tab === 'overview' ? 'Manage access, review learning content, and monitor platform activity.' : tab === 'users' ? 'Manage administrator accounts and access levels.' : tab === 'reviews' ? 'Review submitted question versions before they are published.' : tab === 'catalogue' ? 'Browse question versions across every content workflow state.' : tab === 'import' ? 'Validate question packages and import selected versions as drafts.' : tab === 'learning' ? 'Manage HLD and LLD lessons, review submissions, and publish approved content.' : 'A traceable record of administrative and content workflow activity.'}</p></div><div className="admin-role-chip"><Shield size={14}/>{pretty(user?.role ?? '')}</div></div>
        {error && <div className="admin-alert error"><CircleAlert size={17}/>{error}<button onClick={() => setError('')}><X size={15}/></button></div>}
        {notice && <div className="admin-alert success"><Check size={17}/>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
        {busy && <div className="admin-loading-line"><LoaderCircle size={15}/> Updating workspace…</div>}
        {tab === 'overview' && <>
          <div className="admin-stat-grid">
            {can('admin.users.read') && <Stat icon={<Users/>} label="Administrator accounts" value={users.length} detail="Accounts in the current directory"/>}
            {can('questions.review') && <Stat icon={<FileCheck2/>} label="Awaiting review" value={reviews.length} detail="Submissions in the review queue"/>}
            {can('audit.logs.read') && <Stat icon={<Activity/>} label="Recent activity" value={audit.length} detail="Events in the latest 100 records"/>}
            <Stat icon={<ShieldCheck/>} label="Your access" value={pretty(user?.role ?? '')} detail="Permissions enforced by the server" compact/>
          </div>
          <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Quick actions</h2><p>Jump directly to the areas available to your role.</p></div></div><div className="admin-quick-grid">{nav.filter((n) => n.id !== 'overview' && n.allowed).map((n) => <button key={n.id} onClick={() => setTab(n.id)}><n.icon size={20}/><span><strong>{n.label}</strong><small>Open workspace</small></span><ChevronRight size={17}/></button>)}</div></div>
          <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Access model</h2><p>Role-based access is validated by backend permission guards on every protected operation.</p></div></div><div className="admin-role-grid">{roles.map((r) => <div key={r}><strong>{pretty(r)}</strong><small>{r === 'SUPER_ADMIN' ? 'Full platform administration' : r === 'ADMIN' ? 'Platform and content operations' : r === 'EDITOR' ? 'Create and submit content' : 'Review and approve submissions'}</small></div>)}</div></div>
        </>}
        {tab === 'import' && token && <QuestionImportPanel token={token}/> }
        {tab === 'learning' && token && <LearningAdminPanel token={token} can={can}/>}
        {tab === 'users' && <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Administrator directory</h2><p>{users.length} account(s) returned</p></div>{user?.role === 'SUPER_ADMIN' && <button className="admin-primary-button" onClick={() => setShowCreate(true)}><Plus size={16}/> Add administrator</button>}</div><div className="admin-toolbar"><label className="admin-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email"/></label><button className="admin-secondary-button" onClick={() => void load()}>Search</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th>Actions</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td><strong>{u.name}</strong><small>{u.email}</small></td><td>{user?.role === 'SUPER_ADMIN' && u.id !== user.id ? <select value={u.role} onChange={(e) => void act(() => adminApi.updateRole(token!, u.id, e.target.value as AdminRole), 'Administrator role updated.')}><option value="SUPER_ADMIN">Super Admin</option><option value="ADMIN">Admin</option><option value="EDITOR">Editor</option><option value="REVIEWER">Reviewer</option></select> : <span className="admin-role-pill">{pretty(u.role)}</span>}</td><td><span className={`admin-status ${u.status.toLowerCase()}`}>{pretty(u.status)}</span></td><td>{date(u.lastLoginAt)}</td><td>{date(u.createdAt)}</td><td>{user?.role === 'SUPER_ADMIN' && u.id !== user.id && <button className="admin-text-button" onClick={() => void act(() => adminApi.updateStatus(token!, u.id, u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'), `Administrator ${u.status === 'ACTIVE' ? 'disabled' : 'reactivated'}.`)}>{u.status === 'ACTIVE' ? 'Disable' : 'Reactivate'}</button>}</td></tr>)}{users.length === 0 && <Empty colSpan={6} text="No administrator accounts found."/>}</tbody></table></div></div>}
        {tab === 'catalogue' && <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Question catalogue</h2><p>{catalogue.length} version(s) in the current result</p></div><div className="admin-panel-heading-actions">{can('questions.create') && <button className="admin-primary-button" onClick={() => setEditingVersionId(null)}><Plus size={15}/> New question</button>}<span className="admin-count-pill">Version history</span></div></div><div className="admin-toolbar"><label className="admin-search"><Search size={16}/><input value={catalogueSearch} onChange={(e) => setCatalogueSearch(e.target.value)} placeholder="Search title, ID or slug"/></label><select aria-label="Filter question status" value={catalogueStatus} onChange={(e) => setCatalogueStatus(e.target.value as QuestionVersionStatus | '')}><option value="">All statuses</option>{(['DRAFT','IN_REVIEW','APPROVED','REJECTED','PUBLISHED','ARCHIVED'] as const).map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select><button className="admin-secondary-button" onClick={() => void load()}>Apply filters</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Question</th><th>Version</th><th>Category</th><th>Difficulty</th><th>Status</th><th>Last updated</th><th>Action</th></tr></thead><tbody>{catalogue.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><small>{item.question.slug} · {item.questionId}</small></td><td>v{item.version}</td><td>{pretty(item.category)}</td><td>{pretty(item.difficulty)}</td><td><span className="admin-role-pill">{pretty(item.status)}</span></td><td>{date(item.updatedAt)}</td><td>{(item.status === 'DRAFT' || item.status === 'REJECTED') && can('questions.update_draft') ? <button className="admin-secondary-button" onClick={() => setEditingVersionId(item.id)}>Edit draft</button> : null} {can('questions.submit') && (item.status === 'DRAFT' || item.status === 'REJECTED') ? <button className="admin-primary-button" disabled={busy} onClick={() => void act(() => adminApi.submitVersion(token!, item.id), 'Question version submitted for review.')}>Submit for review</button> : <span className="admin-muted-action">—</span>}</td></tr>)}{catalogue.length === 0 && <Empty colSpan={7} text="No question versions match these filters."/>}</tbody></table></div></div>}
        {tab === 'reviews' && <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Pending submissions</h2><p>Review submitted versions, then publish approved content.</p></div><span className="admin-count-pill">{reviews.length} pending</span></div><div className="admin-review-list">{reviews.map((r) => <article className="admin-review-card" key={r.id}><div className="admin-review-main"><div className="admin-review-meta"><span>{r.question.slug}</span><span>Version {r.version}</span><span>{pretty(r.difficulty)}</span></div><h3>{r.title}</h3><p>{r.subtitle || 'No subtitle provided.'}</p><small>Submitted by {r.creator?.name ?? 'Unknown contributor'} · {date(r.updatedAt)}</small></div><div className="admin-review-actions">{can('questions.approve') && <><button className="admin-approve-button" onClick={() => void act(() => adminApi.approveReview(token!, r.id), 'Submission approved.') }><Check size={15}/> Approve</button><button className="admin-reject-button" onClick={() => { setRejecting(r.id); setRejectText(''); }}>Reject</button></>}{r.status === 'APPROVED' && can('questions.publish') && <button className="admin-primary-button" onClick={() => void act(() => adminApi.publishVersion(token!, r.id), 'Question version published.')}>Publish</button>}</div>{rejecting === r.id && <form className="admin-reject-form" onSubmit={(e) => { e.preventDefault(); void act(() => adminApi.rejectReview(token!, r.id, rejectText), 'Submission rejected.'); setRejecting(null); }}><textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} placeholder="Explain what needs to change (minimum 3 characters)" minLength={3} required/><div><button type="button" className="admin-secondary-button" onClick={() => setRejecting(null)}>Cancel</button><button className="admin-reject-button" type="submit">Confirm rejection</button></div></form>}</article>)}{reviews.length === 0 && <div className="admin-empty"><Check size={22}/><strong>All caught up</strong><span>There are no pending submissions to review.</span></div>}</div>{can('questions.publish') && <div className="admin-publish-section"><div className="admin-panel-heading"><div><h2>Approved · ready to publish</h2><p>Approved versions are kept separate from the review queue.</p></div><span className="admin-count-pill">{approved.length} approved</span></div><div className="admin-review-list">{approved.map((r) => <article className="admin-review-card" key={r.id}><div className="admin-review-main"><div className="admin-review-meta"><span>{r.question.slug}</span><span>Version {r.version}</span><span>Approved</span></div><h3>{r.title}</h3><small>Updated {date(r.updatedAt)}</small></div><div className="admin-review-actions"><button className="admin-primary-button" onClick={() => void act(() => adminApi.publishVersion(token!, r.id), 'Question version published.')}>Publish version</button></div></article>)}{approved.length === 0 && <div className="admin-empty"><span>No approved versions are waiting to be published.</span></div>}</div></div>}</div>}
        {tab === 'audit' && <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Audit events</h2><p>Latest {audit.length} events. Use the action filter to narrow the list.</p></div></div><div className="admin-toolbar"><label className="admin-search"><Search size={16}/><input value={auditAction} onChange={(e) => setAuditAction(e.target.value)} placeholder="Filter by action e.g. AUTH_LOGIN"/></label><button className="admin-secondary-button" onClick={() => void load()}>Apply filter</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Action</th><th>Actor</th><th>Resource</th><th>Resource ID</th><th>Time</th></tr></thead><tbody>{audit.map((a) => <tr key={a.id}><td><strong>{pretty(a.action)}</strong></td><td>{a.actor?.name ?? 'System'}<small>{a.actor?.email ?? '—'}</small></td><td>{a.resourceType}</td><td className="admin-mono">{a.resourceId ?? '—'}</td><td>{date(a.createdAt)}</td></tr>)}{audit.length === 0 && <Empty colSpan={5} text="No audit events match this filter."/>}</tbody></table></div></div>}
      </div>
    </main>
    {editingVersionId !== undefined && token && <QuestionDraftEditor token={token} versionId={editingVersionId} onClose={() => setEditingVersionId(undefined)} onSaved={() => { setEditingVersionId(undefined); void load(); setNotice('Question draft saved.'); }}/>}
    {showCreate && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}><form className="admin-modal" onSubmit={(e) => void create(e)}><div className="admin-modal-heading"><div><h2>Create administrator</h2><p>New accounts are active immediately.</p></div><button type="button" onClick={() => setShowCreate(false)}><X size={18}/></button></div><label>Full name<input required minLength={2} maxLength={100} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}/></label><label>Email address<input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}/></label><label>Temporary password<input required type="password" minLength={12} maxLength={128} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}/><small>At least 12 characters. Share it securely with the new administrator.</small></label><label>Role<select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as AdminRole })}>{roles.map((r) => <option key={r} value={r}>{pretty(r)}</option>)}</select></label><div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="admin-primary-button" type="submit" disabled={busy}>Create account</button></div></form></div>}
  </div>;
}
function Stat({ icon, label, value, detail, compact = false }: { icon: ReactNode; label: string; value: string | number; detail: string; compact?: boolean }) { return <div className="admin-stat"><span className="admin-stat-icon">{icon}</span><small>{label}</small><strong className={compact ? 'compact' : ''}>{value}</strong><span>{detail}</span></div>; }
function Empty({ colSpan, text }: { colSpan: number; text: string }) { return <tr><td colSpan={colSpan} className="admin-table-empty">{text}</td></tr>; }
