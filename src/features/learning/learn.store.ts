import { create } from 'zustand';
import { useMemo } from 'react';
import { api, type ProgressEvent, type ProgressEventType, type Roadmap } from '../../api';
import { computeProgress } from './progress';

interface LearnState {
  status: 'idle' | 'loading' | 'ready' | 'error'; error: string; roadmap: Roadmap | null; events: ProgressEvent[]; notice: string | null;
  load(): Promise<void>; record(nodeId: string, type: ProgressEventType, score?: number): Promise<void>; reset(): Promise<void>; dismiss(): void;
}
export const useLearn = create<LearnState>((set, get) => ({
  status: 'idle', error: '', roadmap: null, events: [], notice: null,
  async load() {
    set({ status: 'loading', error: '' });
    try { const [roadmap, events] = await Promise.all([api.getRoadmap(), api.getProgress()]); set({ roadmap, events, status: 'ready' }); }
    catch (e) { set({ status: 'error', error: (e as Error).message }); }
  },
  /** Optimistic: the screen updates at once, and rolls back with a message if the server refuses. */
  async record(nodeId, type, score) {
    const before = get().events; const optimistic: ProgressEvent = { nodeId, type, ...(score === undefined ? {} : { score }), at: new Date().toISOString() };
    if (type === 'lesson_viewed' && before.some((e) => e.nodeId === nodeId && e.type === type)) return;
    set({ events: [...before, optimistic] });
    try { const saved = await api.recordProgress({ nodeId, type, score }); set({ events: get().events.map((e) => (e === optimistic ? saved : e)) }); }
    catch (e) { set({ events: before, notice: `Your progress could not be saved: ${(e as Error).message}` }); }
  },
  async reset() { try { await api.resetProgress(); set({ events: [], notice: 'Progress reset.' }); } catch (e) { set({ notice: `Could not reset progress: ${(e as Error).message}` }); } },
  dismiss() { set({ notice: null }); },
}));
export function useProgress() {
  const roadmap = useLearn((s) => s.roadmap); const events = useLearn((s) => s.events);
  return useMemo(() => (roadmap ? computeProgress(roadmap.nodes, events) : null), [roadmap, events]);
}
