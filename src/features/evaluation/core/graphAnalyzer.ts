import type { QuestionSpec } from '../../questions/question.types';
import type { ArchEdge, ArchNode, ArchitectureDocument } from '../../architecture/architecture.types';
import { checkConnection } from '../../architecture/connectionRules';

export interface GraphPath { nodeIds: string[]; edgeIds: string[] }
export interface GraphAnalyzer {
  nodes(): ArchNode[];
  edges(): ArchEdge[];
  findComponents(predicate: (node: ArchNode) => boolean): ArchNode[];
  findConnections(predicate: (edge: ArchEdge) => boolean): ArchEdge[];
  hasDirectConnection(sourceId: string, targetId: string, connectionTypeId?: string): boolean;
  findPath(sourceId: string, target: (node: ArchNode) => boolean, connectionTypeIds?: string[]): GraphPath | undefined;
  hasPath(sourceId: string, target: (node: ArchNode) => boolean, connectionTypeIds?: string[]): boolean;
  getReachableComponents(sourceId: string, connectionTypeIds?: string[]): ArchNode[];
}

/** Creates a read-only graph view. Only spec-valid, correctly directed edges participate in traversal. */
export function createGraphAnalyzer(spec: QuestionSpec, doc: ArchitectureDocument): GraphAnalyzer {
  const nodes = [...doc.nodes];
  const edges = [...doc.edges];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const validEdges = edges.filter((edge) => checkConnection(spec, doc, edge.source, edge.target, edge.connectionTypeId).ok);
  const outgoing = new Map<string, ArchEdge[]>();
  for (const edge of validEdges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  const allowed = (edge: ArchEdge, ids?: string[]) => !ids || ids.includes(edge.connectionTypeId);

  function findPath(sourceId: string, target: (node: ArchNode) => boolean, connectionTypeIds?: string[]): GraphPath | undefined {
    if (!nodeById.has(sourceId)) return undefined;
    const queue = [sourceId];
    const visited = new Set([sourceId]);
    const parent = new Map<string, { nodeId: string; edgeId: string }>();
    while (queue.length) {
      const currentId = queue.shift()!;
      const current = nodeById.get(currentId)!;
      if (target(current)) {
        const nodeIds = [currentId]; const edgeIds: string[] = []; let cursor = currentId;
        while (parent.has(cursor)) { const p = parent.get(cursor)!; edgeIds.unshift(p.edgeId); nodeIds.unshift(p.nodeId); cursor = p.nodeId; }
        return { nodeIds, edgeIds };
      }
      for (const edge of outgoing.get(currentId) ?? []) {
        if (!allowed(edge, connectionTypeIds) || visited.has(edge.target) || !nodeById.has(edge.target)) continue;
        visited.add(edge.target); parent.set(edge.target, { nodeId: currentId, edgeId: edge.id }); queue.push(edge.target);
      }
    }
    return undefined;
  }

  return {
    nodes: () => [...nodes], edges: () => [...edges],
    findComponents: (predicate) => nodes.filter(predicate),
    findConnections: (predicate) => edges.filter(predicate),
    hasDirectConnection: (sourceId, targetId, connectionTypeId) => validEdges.some((e) => e.source === sourceId && e.target === targetId && (!connectionTypeId || e.connectionTypeId === connectionTypeId)),
    findPath,
    hasPath: (sourceId, target, ids) => !!findPath(sourceId, target, ids),
    getReachableComponents: (sourceId, ids) => {
      if (!nodeById.has(sourceId)) return [];
      const found: ArchNode[] = []; const seen = new Set([sourceId]); const queue = [sourceId];
      while (queue.length) { const id = queue.shift()!; for (const e of outgoing.get(id) ?? []) {
        if (!allowed(e, ids) || seen.has(e.target) || !nodeById.has(e.target)) continue;
        seen.add(e.target); found.push(nodeById.get(e.target)!); queue.push(e.target);
      }}
      return found;
    }
  };
}
