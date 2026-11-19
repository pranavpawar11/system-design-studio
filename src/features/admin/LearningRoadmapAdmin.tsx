import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Archive, Check, Code2, Eye, FilePlus2, LoaderCircle, RefreshCw, Save, Plus, Trash2, ChevronUp, ChevronDown, Pencil, EyeOff } from 'lucide-react';
import { adminApi, type LearningRoadmapTrack, type LearningRoadmapVersionDetail } from './adminApi';

type Props = { token: string; can: (permission: string) => boolean };
type RoadmapNode = { id?: string; title?: string; summary?: string; kind?: string; status?: string; children?: RoadmapNode[] };
const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const date = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

function TreeEditor({ nodes, onChange, editable }: { nodes: RoadmapNode[]; onChange: (nodes: RoadmapNode[]) => void; editable: boolean }) {
  const updateAt = (path: number[], updater: (items: RoadmapNode[]) => RoadmapNode[]) => {
    const walk = (items: RoadmapNode[], depth: number): RoadmapNode[] => {
      if (depth === path.length) return updater(items);
      const index = path[depth];
      return items.map((node, i) => i === index ? { ...node, children: walk(Array.isArray(node.children) ? node.children : [], depth + 1) } : node);
    };
    onChange(walk(nodes, 0));
  };
  const render = (items: RoadmapNode[], parent: number[] = []): ReactNode => <ul className="roadmap-tree-list">{items.map((node, index) => {
    const path = [...parent, index];
    const change = (patch: Partial<RoadmapNode>) => updateAt(parent, (list) => list.map((item, i) => i === index ? { ...item, ...patch } : item));
    const move = (delta: number) => updateAt(parent, (list) => { const next = [...list]; const target = index + delta; if (target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]]; return next; });
    return <li key={node.id ?? `${node.title}-${index}`}><div className="roadmap-tree-node roadmap-tree-node-edit"><span className={`roadmap-kind ${node.kind ?? 'topic'}`}>{node.kind ?? 'topic'}</span>{editable ? <input aria-label="Node title" value={node.title ?? ''} onChange={(e) => change({ title: e.target.value })}/> : <strong>{node.title ?? node.id ?? 'Untitled node'}</strong>}<small>{node.status ?? 'planned'}</small>{editable && <div className="roadmap-node-actions"><button title="Move up" disabled={index === 0} onClick={() => move(-1)}><ChevronUp size={13}/></button><button title="Move down" disabled={index === items.length - 1} onClick={() => move(1)}><ChevronDown size={13}/></button><button title="Add child" onClick={() => change({ children: [...(node.children ?? []), { id: `new-${Date.now()}`, title: 'New topic', kind: 'topic', status: 'planned', children: [] }] })}><Plus size={13}/></button><button title="Delete node" className="danger" onClick={() => updateAt(parent, (list) => list.filter((_, i) => i !== index))}><Trash2 size={13}/></button></div>}</div>{Array.isArray(node.children) && node.children.length > 0 && render(node.children, path)}</li>;
  })}</ul>;
  return <div className="roadmap-tree-editor">{render(nodes)}{editable && <button className="admin-secondary-button" onClick={() => onChange([...nodes, { id: `new-${Date.now()}`, title: 'New topic', kind: 'topic', status: 'planned', children: [] }])}><Plus size={14}/> Add top-level topic</button>}</div>;
}

export default function LearningRoadmapAdmin({ token, can }: Props) {
  const [tracks, setTracks] = useState<LearningRoadmapTrack[]>([]);
  const [trackKey, setTrackKey] = useState('hld');
  const [detail, setDetail] = useState<LearningRoadmapVersionDetail | null>(null);
  const [json, setJson] = useState('');
  const [mode, setMode] = useState<'tree' | 'json'>('tree');
  const [treeEdit, setTreeEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const selectedTrack = tracks.find((track) => track.key === trackKey);
  const nodes = useMemo(() => {
    try { const value = JSON.parse(json) as { nodes?: RoadmapNode[] }; return Array.isArray(value.nodes) ? value.nodes : []; }
    catch { return []; }
  }, [json]);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const result = await adminApi.listLearningRoadmaps(token);
      setTracks(result.items);
      const selected = result.items.find((item) => item.key === trackKey) ?? result.items[0];
      if (selected && selected.key !== trackKey) setTrackKey(selected.key);
      if (selected) {
        const full = await adminApi.getLearningRoadmap(token, selected.key);
        const version = full.track.roadmapVersions[0] ?? null;
        setDetail(version); setJson(version ? JSON.stringify(version.content, null, 2) : ''); setDirty(false); setTreeEdit(false);
      } else { setDetail(null); setJson(''); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [token, trackKey]);

  useEffect(() => { void load(); }, [load]);
  const chooseTrack = async (key: string) => {
    setTrackKey(key); setBusy(true); setError('');
    try { const result = await adminApi.getLearningRoadmap(token, key); const version = result.track.roadmapVersions[0] ?? null; setDetail(version); setJson(version ? JSON.stringify(version.content, null, 2) : ''); setDirty(false); setTreeEdit(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const chooseVersion = async (versionId: string) => {
    setBusy(true); setError('');
    try { const result = await adminApi.getLearningRoadmap(token, trackKey); const version = result.track.roadmapVersions.find((item) => item.id === versionId) ?? null; setDetail(version); setJson(version ? JSON.stringify(version.content, null, 2) : ''); setDirty(false); setTreeEdit(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const act = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); setNotice(message); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!detail) return;
    let content: Record<string, unknown>;
    try { content = JSON.parse(json) as Record<string, unknown>; }
    catch { setError('The roadmap JSON is invalid. Fix the syntax before saving.'); return; }
    if (!Array.isArray(content.nodes)) { setError('Roadmap content must contain a nodes array.'); return; }
    await act(() => adminApi.updateLearningRoadmapDraft(token, trackKey, detail.id, content), 'Roadmap draft saved.');
  };
  const createVersion = () => void act(async () => { const result = await adminApi.createLearningRoadmapVersion(token, trackKey); setDetail(result.version); setJson(JSON.stringify(result.version.content, null, 2)); setDirty(false); }, 'New roadmap draft created.');

  return <section className="learning-roadmap-admin">
    <div className="learning-admin-heading"><div><h2>Roadmap management</h2><p>Manage versioned HLD and LLD curriculum roadmaps.</p></div><button className="admin-icon-button" onClick={() => void load()} disabled={busy} title="Refresh roadmaps"><RefreshCw size={16}/></button></div>
    {error && <div className="admin-alert error">{error}</div>}{notice && <div className="admin-alert success">{notice}</div>}
    {busy && <div className="admin-loading-line"><LoaderCircle size={15}/> Loading roadmap workspace…</div>}
    <div className="roadmap-track-tabs">{tracks.map((track) => <button key={track.key} className={track.key === trackKey ? 'active' : ''} onClick={() => void chooseTrack(track.key)}><strong>{track.title}</strong><small>{track.key.toUpperCase()} · {track.roadmapVersions.length} version(s)</small></button>)}</div>
    {selectedTrack && <div className="roadmap-workspace">
      <aside className="roadmap-version-sidebar"><div className="admin-panel-heading"><div><h3>Versions</h3><p>{selectedTrack.title}</p></div></div>{selectedTrack.roadmapVersions.map((version) => <button key={version.id} className={`roadmap-version-item ${detail?.id === version.id ? 'active' : ''}`} onClick={() => void chooseVersion(version.id)}><span>Version {version.version}</span><b className={`learning-status ${version.status.toLowerCase()}`}>{pretty(version.status)}</b><small>Updated {date(version.updatedAt)}</small></button>)}{selectedTrack.roadmapVersions.length === 0 && <p className="learning-muted">No roadmap versions.</p>}{can('learning.manage') && <button className="admin-secondary-button roadmap-new-version" disabled={busy || selectedTrack.roadmapVersions.some((v) => v.status === 'DRAFT')} onClick={createVersion}><FilePlus2 size={14}/> Create new version</button>}</aside>
      <div className="roadmap-editor-panel">{detail ? <>
        <div className="roadmap-editor-heading"><div><span>{trackKey.toUpperCase()} · VERSION {detail.version}</span><h3>Curriculum structure</h3><p>{nodes.length} top-level nodes · {detail.status === 'PUBLISHED' ? `Published ${date(detail.publishedAt)}` : `Updated ${date(detail.updatedAt)}`}</p></div><div className="roadmap-editor-actions"><button className={`admin-secondary-button ${mode === 'tree' ? 'selected' : ''}`} onClick={() => setMode('tree')}><Eye size={14}/> Tree</button><button className={`admin-secondary-button ${mode === 'json' ? 'selected' : ''}`} onClick={() => setMode('json')}><Code2 size={14}/> JSON</button></div></div>
        {mode === 'tree' ? <div className="roadmap-tree-view">{nodes.length ? <><div className="roadmap-tree-toolbar">{detail.status === 'DRAFT' && can('learning.manage') && <button className={`admin-secondary-button ${treeEdit ? 'selected' : ''}`} onClick={() => setTreeEdit((v) => !v)}><Pencil size={13}/>{treeEdit ? 'Finish editing' : 'Edit tree'}</button>}</div><TreeEditor nodes={nodes} editable={treeEdit && detail.status === 'DRAFT' && can('learning.manage')} onChange={(next) => { try { const value = JSON.parse(json) as Record<string, unknown>; value.nodes = next; setJson(JSON.stringify(value, null, 2)); setDirty(true); } catch { setError('Could not update roadmap tree.'); } }}/></> : <div className="learning-muted">No roadmap nodes found.</div>}</div> : <textarea className="roadmap-json-editor" value={json} disabled={detail.status !== 'DRAFT' || !can('learning.manage')} onChange={(e) => { setJson(e.target.value); setDirty(true); }} spellCheck={false}/>} 
        {detail.status === 'ARCHIVED' && can('learning.manage') && <div className="roadmap-archive-row"><button className="admin-primary-button" disabled={busy || Boolean(selectedTrack.roadmapVersions.some((item) => item.status === 'DRAFT'))} onClick={() => { if (window.confirm(`Restore archived HLD/LLD Version ${detail.version} as a new draft? The archived version will remain unchanged.`)) void act(async () => { const result = await adminApi.restoreArchivedLearningRoadmap(token, trackKey, detail.id); await load(); await chooseVersion(result.version.id); }, 'Archived roadmap restored as a new draft.'); }}><RefreshCw size={15}/> Restore as draft</button><small>Creates a new draft version; archived history is preserved.</small></div>}
        {detail.status === 'PUBLISHED' && can('learning.publish') && <div className="roadmap-archive-row"><button className="admin-reject-button" disabled={busy} onClick={() => { if (window.confirm('Unpublish this roadmap? It will disappear from the public learner API, while its version remains archived in history.')) void act(() => adminApi.unpublishLearningRoadmap(token, trackKey, detail.id), 'Roadmap unpublished. Its version was preserved in history.'); }}><EyeOff size={14}/> Unpublish roadmap</button></div>}
        {detail.status === 'DRAFT' && can('learning.manage') && <div className="roadmap-editor-footer"><span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span><button className="admin-primary-button" disabled={busy || !dirty} onClick={() => void save()}><Save size={14}/> Save draft</button>{can('learning.publish') && <button className="admin-approve-button" disabled={busy || dirty} onClick={() => void act(() => adminApi.publishLearningRoadmap(token, trackKey, detail.id), 'Roadmap published. Previous published version archived.') }><Check size={14}/> Publish roadmap</button>}</div>}
        {detail.status !== 'PUBLISHED' && detail.status !== 'ARCHIVED' && can('learning.manage') && <div className="roadmap-archive-row"><button className="admin-text-button" disabled={busy} onClick={() => void act(() => adminApi.archiveLearningRoadmap(token, trackKey, detail.id), 'Roadmap version archived.')}><Archive size={14}/> Archive draft</button></div>}
      </> : <div className="admin-empty"><strong>Select a roadmap version</strong><span>Choose HLD or LLD to inspect its curriculum structure.</span></div>}</div>
    </div>}
  </section>;
}
