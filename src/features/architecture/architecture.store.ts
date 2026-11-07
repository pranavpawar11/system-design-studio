import { create } from 'zustand';
import { api } from '../../api';
import { loadSession } from '../../api/session';
import type { Answer, Answers } from '../../api/contracts';
import type { ArchitectureDocument, ArchEdge, ArchNode, ConfigValue } from './architecture.types';
import { checkConnection, compatibleTypes } from './connectionRules';
import type { EvaluationReport } from '../evaluation/evaluation.types';
import { autoLayout, alignNodes, distributeNodes, type AlignKind, type Positions } from './layout';
import type { Interview, SharedState, Snapshot } from './session.types';

/** Loaded through the API client before first render. Swap LocalApi for HttpApi in src/api/index.ts, nothing here changes. */
const session = await loadSession();
export const question = session.question;
export const learning = session.learning;
export const questions = session.questions;
const emptyDoc = (): ArchitectureDocument => ({ schemaVersion: 1, questionId: question.question.id, questionVersion: question.question.version, nodes: [], edges: [] });
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

interface State {
  doc: ArchitectureDocument; past: ArchitectureDocument[]; future: ArchitectureDocument[];
  lastKey: string; lastAt: number;
  selNode: string | null; selEdge: string | null; selIds: string[]; saveState: 'saved' | 'saving' | 'failed'; validating: boolean;
  clipboard: { nodes: ArchNode[]; edges: ArchEdge[]; pastes: number } | null; focusRequest: { id: string; n: number } | null;
  setSelection(ids: string[]): void; removeNodes(ids: string[]): void; copy(): void; paste(): void; duplicate(): void; selectAll(): void; focus(id: string): void;
  fitRequest: number; shared: SharedState; snapshots: Snapshot[]; interview: Interview | null;
  autoLayout(): void; alignSelected(kind: AlignKind): void; distributeSelected(axis: 'h' | 'v'): void;
  setShared(s: SharedState): void; openShared(): void;
  saveSnapshot(name: string): Promise<void>; restoreSnapshot(id: string): void; deleteSnapshot(id: string): Promise<void>;
  startInterview(minutes: number): void; endInterview(): void;
  report: EvaluationReport | null; dirty: boolean; toast: string | null;
  hints: string[]; answers: Answers; setAnswer(id: string, patch: Partial<Answer>): void; loadReference(d: ArchitectureDocument): void; connType: string; workload: { redirectRps: number; multiplier: number }; scenario: { cacheDown: boolean; lostInstances: number };
  setWorkload(w: Partial<State['workload']>): void; setScenario(s: Partial<State['scenario']>): void;
  leftWidth: number; rightWidth: number; showMinimap: boolean; showControls: boolean;
  setWidth(side: 'left' | 'right', w: number): void; setView(v: { showMinimap?: boolean; showControls?: boolean }): void;
  highlight: string[]; leftOpen: boolean; rightOpen: boolean;
  setHighlight(ids: string[]): void; togglePanel(side: 'left' | 'right'): void; draftErrors: string[] | null;
  addNode(componentId: string, pos?: { x: number; y: number }): void;
  beginDrag(): void; moveNode(id: string, pos: { x: number; y: number }): void;
  renameNode(id: string, name: string): void; setConfig(id: string, k: string, v: ConfigValue): void;
  removeNode(id: string): void; removeEdge(id: string): void;
  connect(source: string, target: string): void; setEdgeType(id: string, typeId: string): void;
  select(node: string | null, edge: string | null): void;
  undo(): void; redo(): void; reset(): void; replaceDoc(d: ArchitectureDocument): void;
  validate(): Promise<void>; save(): Promise<void>; revealHint(id: string): void;
  setConnType(t: string): void; notify(m: string | null): void; discardDraft(): Promise<void>;
}

const LAYOUT_KEY = 'hld-studio:layout:v1';
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const layout = (() => {
  const d = { leftWidth: 290, rightWidth: 380, showMinimap: true, showControls: true };
  try {
    const r = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}');
    return { leftWidth: clamp(Number(r.leftWidth) || d.leftWidth, 220, 560), rightWidth: clamp(Number(r.rightWidth) || d.rightWidth, 280, 640), showMinimap: r.showMinimap !== false, showControls: r.showControls !== false };
  } catch { return d; }
})();
const init = session.draft;

export const useStudio = create<State>((set, get) => {
  const push = (s: State, key = '') => {
    const now = Date.now();
    if (key && key === s.lastKey && now - s.lastAt < 1200) return { lastAt: now };
    return { past: [...s.past.slice(-49), s.doc], future: [] as ArchitectureDocument[], lastKey: key, lastAt: now };
  };
  const edit = (fn: (d: ArchitectureDocument) => ArchitectureDocument, key?: string) =>
    set((s) => ({ ...push(s, key), doc: fn(s.doc), dirty: true }));

  const applyPositions = (pos: Positions) => edit((d) => ({ ...d, nodes: d.nodes.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)) }));

  return {
    doc: init.status === 'ok' ? init.draft.doc : emptyDoc(), past: [], future: [], lastKey: '', lastAt: 0,
    selNode: null, selIds: [], selEdge: null, report: null, dirty: false, toast: null,
    hints: init.status === 'ok' ? init.draft.hints : [], answers: init.status === 'ok' ? init.draft.answers : {}, connType: 'auto',
    setAnswer(id, patch) { set((s) => ({ answers: { ...s.answers, [id]: { ...({ text: '', covered: [], revealed: false } as Answer), ...s.answers[id], ...patch } }, dirty: true })); },
    loadReference(d) { set((s) => ({ ...push(s), doc: structuredClone(d), selNode: null, selIds: [], selEdge: null, report: null, highlight: [], dirty: true })); }, workload: { redirectRps: 10000, multiplier: 1 }, scenario: { cacheDown: false, lostInstances: 0 },
    setWorkload(w) { set((s) => ({ workload: { ...s.workload, ...w } })); }, setScenario(sc) { set((s) => ({ scenario: { ...s.scenario, ...sc } })); },
    ...layout,
    setWidth(side, w) { set(side === 'left' ? { leftWidth: clamp(w, 220, 560) } : { rightWidth: clamp(w, 280, 640) }); },
    setView(v) { set(v); },
    highlight: [], leftOpen: true, rightOpen: true, clipboard: null, focusRequest: null, fitRequest: 0, shared: null, snapshots: session.snapshots, interview: session.interview, saveState: 'saved', validating: false,
    setHighlight(highlight) { set({ highlight }); },
    togglePanel(side) { set((s) => (side === 'left' ? { leftOpen: !s.leftOpen } : { rightOpen: !s.rightOpen })); },
    draftErrors: init.status === 'corrupt' ? init.errors : null,

    addNode(componentId, pos) {
      const c = question.componentCatalogue.components.find((x) => x.id === componentId);
      if (!c) return get().notify(`Unknown component ${componentId}.`);
      const { doc } = get();
      const same = doc.nodes.filter((n) => n.componentId === componentId).length;
      const i = doc.nodes.length;
      const node: ArchNode = {
        id: uid('node'), componentId, componentType: c.type, name: same ? `${c.displayName} ${same + 1}` : c.displayName,
        position: pos ?? { x: 60 + (i % 3) * 240, y: 50 + Math.floor(i / 3) * 120 }, config: { ...c.defaultConfig },
      };
      edit((d) => ({ ...d, nodes: [...d.nodes, node] }));
      set({ selNode: node.id, selIds: [node.id], selEdge: null });
    },
    beginDrag() { set((s) => ({ ...push(s) })); },
    moveNode(id, position) { set((s) => ({ doc: { ...s.doc, nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, position } : n)) }, dirty: true })); },
    renameNode(id, name) { edit((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, name } : n)) }), `rn-${id}`); },
    setConfig(id, k, v) { edit((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, [k]: v } } : n)) }), `cfg-${id}-${k}`); },
    removeNode(id) {
      if (!get().doc.nodes.some((n) => n.id === id)) return;
      edit((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== id), edges: d.edges.filter((e) => e.source !== id && e.target !== id) }));
      set({ selNode: null });
    },
    removeEdge(id) {
      if (!get().doc.edges.some((e) => e.id === id)) return;
      edit((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
      set({ selEdge: null });
    },
    connect(source, target) {
      const { doc, connType } = get();
      if (source === target) return get().notify('A component cannot connect to itself.');
      const typeId = connType === 'auto' ? compatibleTypes(question, doc, source, target)[0]?.id : connType;
      if (!typeId) return get().notify('These components have no compatible connection type.');
      const r = checkConnection(question, doc, source, target, typeId);
      if (!r.ok) return get().notify(r.reason ?? 'Invalid connection.');
      if (doc.edges.some((e) => e.source === source && e.target === target && e.connectionTypeId === typeId)) return get().notify('That connection already exists.');
      const id = uid('edge');
      edit((d) => ({ ...d, edges: [...d.edges, { id, source, target, connectionTypeId: typeId }] }));
      set({ selEdge: id, selNode: null, selIds: [] });
    },
    setEdgeType(id, typeId) {
      const e = get().doc.edges.find((x) => x.id === id); if (!e) return;
      const r = checkConnection(question, get().doc, e.source, e.target, typeId);
      if (!r.ok) return get().notify(r.reason ?? 'Invalid connection type.');
      edit((d) => ({ ...d, edges: d.edges.map((x) => (x.id === id ? { ...x, connectionTypeId: typeId } : x)) }));
    },
    setSelection(ids) { set((s) => ({ selIds: ids, selNode: ids.length === 1 ? ids[0] : null, selEdge: ids.length ? null : s.selEdge, highlight: [] })); },
    removeNodes(ids) {
      if (!ids.length) return;
      const gone = new Set(ids);
      edit((d) => ({ ...d, nodes: d.nodes.filter((n) => !gone.has(n.id)), edges: d.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)) }));
      set({ selNode: null, selIds: [] });
    },
    copy() {
      const { doc, selIds } = get();
      if (!selIds.length) return get().notify('Select one or more components first.');
      const ids = new Set(selIds);
      set({ clipboard: { nodes: doc.nodes.filter((n) => ids.has(n.id)).map((n) => structuredClone(n)), edges: doc.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e })), pastes: 0 }, toast: `Copied ${ids.size} component${ids.size === 1 ? '' : 's'}.` });
    },
    paste() {
      const cb = get().clipboard;
      if (!cb) return get().notify('Nothing copied yet.');
      const k = cb.pastes + 1; const map = new Map<string, string>();
      const nodes = cb.nodes.map((n) => { const id = uid('node'); map.set(n.id, id); return { ...structuredClone(n), id, name: `${n.name} (copy)`, position: { x: n.position.x + 40 * k, y: n.position.y + 40 * k } }; });
      const edges = cb.edges.map((e) => ({ ...e, id: uid('edge'), source: map.get(e.source)!, target: map.get(e.target)! }));
      edit((d) => ({ ...d, nodes: [...d.nodes, ...nodes], edges: [...d.edges, ...edges] }));
      set({ clipboard: { ...cb, pastes: k }, selIds: nodes.map((n) => n.id), selNode: nodes.length === 1 ? nodes[0].id : null, selEdge: null });
    },
    duplicate() { get().copy(); if (get().clipboard) get().paste(); },
    selectAll() { get().setSelection(get().doc.nodes.map((n) => n.id)); },
    autoLayout() {
      if (!get().doc.nodes.length) return get().notify('Add components before using auto-layout.');
      const pos = autoLayout(get().doc); applyPositions(pos); set((s) => ({ fitRequest: s.fitRequest + 1 }));
    },
    alignSelected(kind) {
      const { doc, selIds } = get(); const pos = alignNodes(doc.nodes, selIds, kind);
      if (!Object.keys(pos).length) return get().notify('Select at least two components to align.');
      applyPositions(pos);
    },
    distributeSelected(axis) {
      const { doc, selIds } = get(); const pos = distributeNodes(doc.nodes, selIds, axis);
      if (!Object.keys(pos).length) return get().notify('Select at least three components to distribute.');
      applyPositions(pos);
    },
    setShared(shared) { set({ shared }); },
    openShared() {
      const sh = get().shared;
      if (sh?.kind === 'design') get().replaceDoc(sh.doc);
      set({ shared: null });
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* ignore */ }
    },
    async saveSnapshot(name) {
      const { doc } = get();
      if (!doc.nodes.length) return get().notify('Add components before saving a snapshot.');
      try { const snap = await api.createSnapshot(question.question.id, { name, doc }); set((s) => ({ snapshots: [...s.snapshots, snap], toast: `Saved “${snap.name}”.` })); }
      catch (e) { get().notify((e as Error).message); }
    },
    restoreSnapshot(id) {
      const s = get().snapshots.find((x) => x.id === id); if (!s) return;
      get().replaceDoc(structuredClone(s.doc)); get().notify(`Restored “${s.name}”. You can undo this.`);
    },
    async deleteSnapshot(id) {
      try { await api.deleteSnapshot(question.question.id, id); set((s) => ({ snapshots: s.snapshots.filter((x) => x.id !== id) })); }
      catch (e) { get().notify((e as Error).message); }
    },
    startInterview(minutes) {
      if (!Number.isFinite(minutes) || minutes <= 0) return get().notify('Choose a duration.');
      set({ interview: { startedAt: Date.now(), durationMs: minutes * 60000, validations: 0 }, report: null });
    },
    endInterview() { set((s) => (s.interview && !s.interview.endedAt ? { interview: { ...s.interview, endedAt: Date.now() } } : s)); },
    focus(id) { set((s) => ({ focusRequest: { id, n: (s.focusRequest?.n ?? 0) + 1 }, selNode: id, selIds: [id], selEdge: null, highlight: [] })); },
    select(selNode, selEdge) { set({ selNode, selEdge, selIds: selNode ? [selNode] : [], highlight: [] }); },
    undo() { set((s) => (s.past.length ? { doc: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.doc, ...s.future], dirty: true, selNode: null, selIds: [], selEdge: null, lastKey: '' } : s)); },
    redo() { set((s) => (s.future.length ? { doc: s.future[0], future: s.future.slice(1), past: [...s.past, s.doc], dirty: true, selNode: null, selIds: [], selEdge: null, lastKey: '' } : s)); },
    reset() { set((s) => ({ ...push(s), doc: emptyDoc(), selNode: null, selIds: [], selEdge: null, report: null, hints: [], dirty: true })); },
    replaceDoc(d) { set((s) => ({ ...push(s), doc: d, selNode: null, selIds: [], selEdge: null, report: null, dirty: true })); },
    async validate() {
      set((s) => ({ validating: true, interview: s.interview && !s.interview.endedAt ? { ...s.interview, validations: s.interview.validations + 1 } : s.interview }));
      try { const report = await api.evaluate(question.question.id, { doc: get().doc }); set({ report, validating: false }); }
      catch (e) { set({ validating: false, toast: `Validation failed: ${(e as Error).message}` }); }
    },
    async save() {
      const s = get(); set({ saveState: 'saving' });
      try { await api.saveDraft(question.question.id, { doc: s.doc, hints: s.hints, answers: s.answers }); set({ dirty: false, saveState: 'saved', draftErrors: null, toast: 'Saved.' }); }
      catch (e) { set({ saveState: 'failed', toast: `Could not save: ${(e as Error).message}` }); }
    },
    revealHint(id) { const iv = get().interview; if (iv && !iv.endedAt) return get().notify('Hints are disabled during an interview session.'); set((s) => (s.hints.includes(id) ? s : { hints: [...s.hints, id], dirty: true })); },
    setConnType(connType) { set({ connType }); },
    notify(toast) { set({ toast }); },
    async discardDraft() { try { await api.deleteDraft(question.question.id); set({ draftErrors: null }); } catch (e) { set({ toast: `Could not discard the draft: ${(e as Error).message}` }); } },
  };
});

let timer: ReturnType<typeof setTimeout> | undefined;
useStudio.subscribe((s, prev) => {
  if (s.doc === prev.doc && s.hints === prev.hints && s.answers === prev.answers) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const { doc, hints, answers, draftErrors } = useStudio.getState();
    if (draftErrors) return; // never overwrite a corrupted draft until the user decides
    useStudio.setState({ saveState: 'saving' });
    try { await api.saveDraft(question.question.id, { doc, hints, answers }); useStudio.setState({ dirty: false, saveState: 'saved' }); }
    catch (e) { useStudio.setState({ saveState: 'failed', toast: `Could not save your work: ${(e as Error).message}` }); }
  }, 700);
});

useStudio.subscribe((s, prev) => {
  if (s.leftWidth === prev.leftWidth && s.rightWidth === prev.rightWidth && s.showMinimap === prev.showMinimap && s.showControls === prev.showControls) return;
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ leftWidth: s.leftWidth, rightWidth: s.rightWidth, showMinimap: s.showMinimap, showControls: s.showControls })); } catch { /* ignore */ }
});

useStudio.subscribe((s, prev) => {
  if (s.interview === prev.interview) return;
  const id = question.question.id;
  (s.interview ? api.saveInterview(id, s.interview) : api.deleteInterview(id)).catch((e: Error) => useStudio.setState({ toast: `Could not save your interview session: ${e.message}` }));
});
if (session.warnings.length) useStudio.setState({ toast: session.warnings[0] });
