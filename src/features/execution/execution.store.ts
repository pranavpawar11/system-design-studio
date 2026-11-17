import { create } from 'zustand';
import { executeCode } from './execution.service';
import type { ExecutionRequest, ExecutionResult } from './execution.types';

interface ExecutionState {
  status: 'idle' | 'accepted' | 'running' | 'completed' | 'failed' | 'unavailable';
  result: ExecutionResult | null;
  error: string | null;
  run(request: ExecutionRequest): Promise<void>;
  reset(): void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  status: 'idle',
  result: null,
  error: null,
  async run(request) {
    set({ status: 'running', result: null, error: null });
    try {
      const result = await executeCode(request);
      set({ result, status: result.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Code execution failed.';
      set({ status: message.includes('not configured') || message.includes('does not support') ? 'unavailable' : 'failed', result: null, error: message });
    }
  },
  reset() { set({ status: 'idle', result: null, error: null }); },
}));
