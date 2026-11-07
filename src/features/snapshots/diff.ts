import type { ArchitectureDocument } from '../architecture/architecture.types';

export interface DocDiff {
  addedNodes: string[]; removedNodes: string[]; changedNodes: { name: string; changes: string[] }[];
  addedEdges: string[]; removedEdges: string[]; movedCount: number; identical: boolean;
}
export function diffDocs(from: ArchitectureDocument, to: ArchitectureDocument, typeName: (id: string) => string = (x) => x): DocDiff {
  const a = new Map(from.nodes.map((n) => [n.id, n])); const b = new Map(to.nodes.map((n) => [n.id, n]));
  const nm = (id: string) => b.get(id)?.name ?? a.get(id)?.name ?? id;
  const edgeLabel = (e: { source: string; target: string; connectionTypeId: string }) => `${nm(e.source)} → ${nm(e.target)} (${typeName(e.connectionTypeId)})`;
  const key = (e: { source: string; target: string; connectionTypeId: string }) => `${e.source}|${e.target}|${e.connectionTypeId}`;
  const ea = new Map(from.edges.map((e) => [key(e), e])); const eb = new Map(to.edges.map((e) => [key(e), e]));
  const changedNodes: DocDiff['changedNodes'] = []; let movedCount = 0;
  for (const [id, n] of b) {
    const o = a.get(id); if (!o) continue;
    const changes: string[] = [];
    if (o.name !== n.name) changes.push(`renamed “${o.name}” → “${n.name}”`);
    for (const k of new Set([...Object.keys(o.config), ...Object.keys(n.config)])) if (o.config[k] !== n.config[k]) changes.push(`${k}: ${String(o.config[k] ?? 'unset')} → ${String(n.config[k] ?? 'unset')}`);
    if (changes.length) changedNodes.push({ name: n.name, changes });
    else if (o.position.x !== n.position.x || o.position.y !== n.position.y) movedCount++;
  }
  const d: DocDiff = {
    addedNodes: [...b.keys()].filter((i) => !a.has(i)).map(nm), removedNodes: [...a.keys()].filter((i) => !b.has(i)).map(nm), changedNodes,
    addedEdges: [...eb].filter(([k]) => !ea.has(k)).map(([, e]) => edgeLabel(e)), removedEdges: [...ea].filter(([k]) => !eb.has(k)).map(([, e]) => edgeLabel(e)), movedCount, identical: false,
  };
  d.identical = !d.addedNodes.length && !d.removedNodes.length && !d.changedNodes.length && !d.addedEdges.length && !d.removedEdges.length && !movedCount;
  return d;
}
