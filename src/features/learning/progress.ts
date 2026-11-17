import type { ProgressEvent, RoadmapNode } from './types';

export type NodeState = 'done' | 'doing' | 'todo' | 'planned';
export interface NodeProgress {
  state: NodeState; done: number; total: number; planned: number; percent: number;
  /** Everything written so far is done, but more lessons are still to come. Not the same as finished. */
  caughtUp: boolean;
}
export interface ProgressSummary { byId: Map<string, NodeProgress>; done: number; total: number; planned: number; percent: number; nextUp: RoadmapNode | null }

export const leaves = (nodes: RoadmapNode[]): RoadmapNode[] => nodes.flatMap((n) => (n.children?.length ? leaves(n.children) : n.kind === 'lesson' ? [n] : []));

/** A lesson is complete when everything it asks of the learner is done. Reading alone does not count when there is a lab or quiz. */
export function isLessonDone(node: RoadmapNode, events: ProgressEvent[]): boolean {
  const has = (type: ProgressEvent['type']) => events.some((e) => e.nodeId === node.id && e.type === type);
  if (node.hasLab || node.hasQuiz) return (!node.hasLab || has('lab_completed')) && (!node.hasQuiz || has('quiz_passed'));
  return has('lesson_read');
}

/**
 * Progress is derived from the event list, never stored as a number, so it cannot drift.
 * Planned lessons are shown but never counted toward completion.
 */
export function computeProgress(nodes: RoadmapNode[], events: ProgressEvent[]): ProgressSummary {
  const byId = new Map<string, NodeProgress>();
  const visit = (n: RoadmapNode): NodeProgress => {
    let p: NodeProgress;
    if (n.children?.length) {
      const kids = n.children.map(visit);
      const done = kids.reduce((a, k) => a + k.done, 0); const total = kids.reduce((a, k) => a + k.total, 0); const planned = kids.reduce((a, k) => a + k.planned, 0);
      const anyActive = kids.some((k) => k.state === 'doing') || done > 0;
      // 'done' means nothing remains. Finished-but-more-is-coming reads as in progress, with caughtUp set.
      p = { done, total, planned, percent: total ? Math.round((done / total) * 100) : 0, caughtUp: total > 0 && done === total && planned > 0, state: total === 0 ? 'planned' : done === total && planned === 0 ? 'done' : anyActive ? 'doing' : 'todo' };
    } else if (n.status === 'planned') p = { state: 'planned', done: 0, total: 0, planned: 1, percent: 0, caughtUp: false };
    else {
      const done = isLessonDone(n, events); const touched = events.some((e) => e.nodeId === n.id);
      p = { state: done ? 'done' : touched ? 'doing' : 'todo', done: done ? 1 : 0, total: 1, planned: 0, percent: done ? 100 : 0, caughtUp: false };
    }
    byId.set(n.id, p); return p;
  };
  const tops = nodes.map(visit);
  const done = tops.reduce((a, t) => a + t.done, 0); const total = tops.reduce((a, t) => a + t.total, 0); const planned = tops.reduce((a, t) => a + t.planned, 0);
  const ready = leaves(nodes).filter((l) => l.status === 'ready');
  // Guidance, not a gate. Continue what you started; otherwise the unfinished lesson that FOLLOWS the one you touched last
  // (so finishing a lesson leads onward, not back to the top of the map); otherwise the first unfinished lesson.
  const last = ready.findIndex((l) => l.id === events[events.length - 1]?.nodeId);
  const after = last >= 0 ? [...ready.slice(last + 1), ...ready.slice(0, last)] : ready;
  const nextUp = ready.find((l) => byId.get(l.id)?.state === 'doing') ?? after.find((l) => byId.get(l.id)?.state === 'todo') ?? null;
  return { byId, done, total, planned, percent: total ? Math.round((done / total) * 100) : 0, nextUp };
}

/** The topic and group titles above a lesson, for the breadcrumb. */
export function pathTo(nodes: RoadmapNode[], id: string, trail: RoadmapNode[] = []): RoadmapNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return [...trail, n];
    const hit = n.children ? pathTo(n.children, id, [...trail, n]) : null; if (hit) return hit;
  }
  return null;
}
