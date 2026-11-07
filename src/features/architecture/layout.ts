import type { ArchitectureDocument, ArchNode } from './architecture.types';

export const NODE_W = 220; export const NODE_H = 64;
export type Positions = Record<string, { x: number; y: number }>;
export type AlignKind = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * Deterministic left-to-right layered layout. Layers follow the longest path from the entry points;
 * cycles are broken at back edges, and unconnected components go in a final column.
 */
export function autoLayout(doc: ArchitectureDocument, gapX = 110, gapY = 50): Positions {
  const ids = doc.nodes.map((n) => n.id);
  const pos = new Map(doc.nodes.map((n) => [n.id, n.position]));
  const edges = doc.edges.filter((e) => e.source !== e.target && pos.has(e.source) && pos.has(e.target));
  const connected = new Set(edges.flatMap((e) => [e.source, e.target]));
  const nodesC = ids.filter((i) => connected.has(i));
  const byY = (a: string, b: string) => pos.get(a)!.y - pos.get(b)!.y || pos.get(a)!.x - pos.get(b)!.x || a.localeCompare(b);

  const out = new Map<string, string[]>(); const indeg = new Map<string, number>();
  for (const i of nodesC) { out.set(i, []); indeg.set(i, 0); }
  for (const e of edges) { out.get(e.source)!.push(e.target); indeg.set(e.target, indeg.get(e.target)! + 1); }
  for (const l of out.values()) l.sort(byY);

  // DFS to find back edges (cycles)
  const state = new Map<string, 0 | 1 | 2>(); const back = new Set<string>();
  const roots = nodesC.filter((i) => indeg.get(i) === 0).sort(byY);
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) { if (state.get(v) === 1) back.add(`${u}>${v}`); else if (!state.get(v)) visit(v); }
    state.set(u, 2);
  };
  for (const r of [...roots, ...[...nodesC].sort(byY)]) if (!state.get(r)) visit(r);

  // Longest-path layering over forward edges
  const layer = new Map<string, number>(nodesC.map((i) => [i, 0]));
  for (let pass = 0; pass < nodesC.length; pass++) {
    let changed = false;
    for (const e of edges) if (!back.has(`${e.source}>${e.target}`) && layer.get(e.target)! < layer.get(e.source)! + 1) { layer.set(e.target, layer.get(e.source)! + 1); changed = true; }
    if (!changed) break;
  }
  const maxLayer = nodesC.length ? Math.max(...layer.values()) : -1;
  const cols: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const i of nodesC) cols[layer.get(i)!].push(i);
  cols.forEach((c) => c.sort(byY));
  // two barycenter sweeps to reduce crossings
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let l = 1; l < cols.length; l++) {
      const prev = new Map(cols[l - 1].map((id, idx) => [id, idx]));
      const score = (id: string) => { const ps = edges.filter((e) => e.target === id && prev.has(e.source)).map((e) => prev.get(e.source)!); return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : Infinity; };
      cols[l].sort((a, b) => (score(a) - score(b)) || byY(a, b));
    }
  }
  const lone = ids.filter((i) => !connected.has(i)).sort(byY);
  if (lone.length) cols.push(lone);

  const rowH = NODE_H + gapY; const tallest = Math.max(1, ...cols.map((c) => c.length));
  const result: Positions = {};
  cols.forEach((col, ci) => { const off = ((tallest - col.length) * rowH) / 2; col.forEach((id, ri) => { result[id] = { x: ci * (NODE_W + gapX), y: off + ri * rowH }; }); });
  return result;
}

export function alignNodes(nodes: ArchNode[], ids: string[], kind: AlignKind): Positions {
  const sel = nodes.filter((n) => ids.includes(n.id)); const out: Positions = {};
  if (sel.length < 2) return out;
  const xs = sel.map((n) => n.position.x); const ys = sel.map((n) => n.position.y);
  const target = { left: Math.min(...xs), right: Math.max(...xs), center: (Math.min(...xs) + Math.max(...xs)) / 2, top: Math.min(...ys), bottom: Math.max(...ys), middle: (Math.min(...ys) + Math.max(...ys)) / 2 }[kind];
  for (const n of sel) out[n.id] = ['left', 'center', 'right'].includes(kind) ? { x: target, y: n.position.y } : { x: n.position.x, y: target };
  return out;
}

/** Equal spacing between the outermost selected nodes (needs at least three). */
export function distributeNodes(nodes: ArchNode[], ids: string[], axis: 'h' | 'v'): Positions {
  const k = axis === 'h' ? 'x' : 'y'; const out: Positions = {};
  const sel = nodes.filter((n) => ids.includes(n.id)).sort((a, b) => a.position[k] - b.position[k]);
  if (sel.length < 3) return out;
  const first = sel[0].position[k]; const last = sel[sel.length - 1].position[k];
  sel.forEach((n, i) => { const v = first + (i * (last - first)) / (sel.length - 1); out[n.id] = k === 'x' ? { x: v, y: n.position.y } : { x: n.position.x, y: v }; });
  return out;
}
