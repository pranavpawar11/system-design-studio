import type { ArchitectureDocument } from './architecture.types';

export interface Snapshot { id: string; name: string; createdAt: string; doc: ArchitectureDocument }
export interface Interview { startedAt: number; durationMs: number; endedAt?: number; validations: number }
export type SharedState = null
  | { kind: 'design'; doc: ArchitectureDocument }
  | { kind: 'other-question'; questionId: string }
  | { kind: 'error'; message: string };
