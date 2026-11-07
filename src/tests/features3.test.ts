import { describe, it, expect, beforeEach } from 'vitest';
import solvedV2 from './fixtures/url-shortener-solved-v2.json';
import { autoLayout, alignNodes, distributeNodes, NODE_W, NODE_H } from '../features/architecture/layout';
import { encodeShare, parseShare, MAX_SHARE_CHARS } from '../api/local/shareCodec';
import { diffDocs } from '../features/snapshots/diff';
import { useStudio } from '../features/architecture/architecture.store';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const doc = () => structuredClone(solvedV2) as unknown as ArchitectureDocument;

describe('auto-layout', () => {
  it('orders components left to right along every request flow, without overlaps', () => {
    const d = doc(); const p = autoLayout(d);
    for (const e of d.edges) expect(p[e.target].x).toBeGreaterThan(p[e.source].x);
    const ids = Object.keys(p);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = p[ids[i]], b = p[ids[j]];
      const overlap = Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;
      expect(overlap, `${ids[i]} overlaps ${ids[j]}`).toBe(false);
    }
  });
  it('is deterministic and ignores the starting positions of edges-connected structure', () => {
    const a = doc(); const b = doc(); b.nodes.forEach((n, i) => { n.position = { x: i * 3, y: 500 - i * 7 }; });
    expect(Object.keys(autoLayout(a))).toEqual(Object.keys(autoLayout(a)));
    expect(autoLayout(a)).toEqual(autoLayout(a));
    for (const e of b.edges) { const p = autoLayout(b); expect(p[e.target].x).toBeGreaterThan(p[e.source].x); }
  });
  it('survives cycles and puts unconnected components in a final column', () => {
    const d = doc(); d.edges.push({ id: 'cyc', source: 'app', target: 'client', connectionTypeId: 'EDGE-SYNC-HTTP' });
    d.nodes.push({ id: 'lone', componentId: 'COMP-DNS', componentType: 'dns', name: 'DNS', position: { x: 0, y: 0 }, config: {} });
    const p = autoLayout(d);
    expect(Object.keys(p)).toHaveLength(d.nodes.length);
    const maxConnected = Math.max(...d.nodes.filter((n) => n.id !== 'lone').map((n) => p[n.id].x));
    expect(p.lone.x).toBeGreaterThan(maxConnected);
  });
  it('handles an empty design', () => expect(autoLayout({ ...doc(), nodes: [], edges: [] })).toEqual({}));
});

describe('align and distribute', () => {
  const nodes = () => doc().nodes.slice(0, 4).map((n, i) => ({ ...n, position: { x: i * 100 + (i % 2) * 30, y: i * 40 } }));
  it('aligns left and top', () => {
    const n = nodes(); const ids = n.map((x) => x.id);
    expect(new Set(Object.values(alignNodes(n, ids, 'left')).map((p) => p.x)).size).toBe(1);
    expect(new Set(Object.values(alignNodes(n, ids, 'top')).map((p) => p.y)).size).toBe(1);
  });
  it('distributes evenly, and needs three or more', () => {
    const n = nodes(); const ids = n.map((x) => x.id); const p = distributeNodes(n, ids, 'h');
    const xs = ids.map((i) => p[i].x).sort((a, b) => a - b); const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    gaps.forEach((g) => expect(g).toBeCloseTo(gaps[0]));
    expect(distributeNodes(n, ids.slice(0, 2), 'h')).toEqual({});
    expect(alignNodes(n, ids.slice(0, 1), 'left')).toEqual({});
  });
});

describe('share links', () => {
  it('round-trips a design', async () => {
    const d = doc(); const s = await encodeShare('hld-url-shortener-001', d);
    expect(s).toMatch(/^[zp]\./); expect(s).not.toMatch(/[+/=]/);
    const back = await parseShare(s);
    expect(back.questionId).toBe('hld-url-shortener-001'); expect(back.doc).toEqual(d);
  });
  it('rejects damaged or foreign payloads with a clear message', async () => {
    await expect(parseShare('garbage')).rejects.toThrow(/damaged/);
    await expect(parseShare('z.AAAA')).rejects.toThrow(/damaged/);
    await expect(parseShare('p.' + btoa('{"hello":1}'))).rejects.toThrow(/damaged/);
  });
  it('refuses links that would be too large', async () => {
    const big = { ...doc(), blob: Array.from({ length: 120000 }, () => Math.random().toString(36)[2]).join('') };
    await expect(encodeShare('x', big)).rejects.toThrow(/too large/);
    expect(MAX_SHARE_CHARS).toBeGreaterThan(1000);
  });
});

describe('snapshot diff', () => {
  it('reports additions, removals, config changes and pure moves', () => {
    const a = doc(); const b = doc();
    b.nodes = b.nodes.filter((n) => n.id !== 'logs'); b.edges = b.edges.filter((e) => e.target !== 'logs');
    b.nodes.find((n) => n.id === 'app')!.config.instances = 8;
    b.nodes.find((n) => n.id === 'cache')!.position = { x: 5, y: 5 };
    b.nodes.push({ id: 'new', componentId: 'COMP-CDN', componentType: 'cdn', name: 'CDN', position: { x: 0, y: 0 }, config: {} });
    const d = diffDocs(a, b);
    expect(d.removedNodes).toEqual(['Logging & Tracing']); expect(d.addedNodes).toEqual(['CDN']);
    expect(d.changedNodes[0].changes[0]).toBe('instances: 4 → 8'); expect(d.removedEdges.length).toBe(1); expect(d.movedCount).toBe(1);
    expect(diffDocs(a, doc()).identical).toBe(true);
  });
});

describe('store: layout and interview', () => {
  beforeEach(() => { localStorage.clear(); useStudio.setState({ interview: null, hints: [], report: null }); useStudio.getState().replaceDoc(doc()); useStudio.setState({ past: [], future: [] }); });
  it('auto-layout is a single undoable step', () => {
    const before = structuredClone(useStudio.getState().doc.nodes.map((n) => n.position));
    useStudio.getState().autoLayout();
    expect(useStudio.getState().past).toHaveLength(1);
    useStudio.getState().undo();
    expect(useStudio.getState().doc.nodes.map((n) => n.position)).toEqual(before);
  });
  it('interview mode blocks hints, counts validations, and unlocks hints when ended', () => {
    const s = () => useStudio.getState();
    s().startInterview(30); s().revealHint('HINT-01');
    expect(s().hints).toHaveLength(0); expect(s().toast).toMatch(/disabled during an interview/);
    s().validate(); s().validate(); expect(s().interview!.validations).toBe(2);
    s().endInterview(); expect(s().interview!.endedAt).toBeTypeOf('number');
    s().validate(); expect(s().interview!.validations).toBe(2);
    s().revealHint('HINT-01'); expect(s().hints).toHaveLength(1);
  });
  it('persists the interview across reloads', () => {
    useStudio.getState().startInterview(20);
    expect(JSON.parse(localStorage.getItem('hld-studio:interview:hld-url-shortener-001:v1')!).durationMs).toBe(20 * 60000);
  });
  it('rejects an invalid duration', () => { useStudio.getState().startInterview(0); expect(useStudio.getState().interview).toBeNull(); });
});
