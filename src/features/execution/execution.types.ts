import type { ProgrammingLanguage } from '../preferences/preferences.types';
import type { PracticeCodeFile } from '../practice/practice.types';

export interface ExecutionRequest {
  exerciseId: string;
  language: ProgrammingLanguage;
  files: PracticeCodeFile[];
  stdin?: string;
  timeoutMs?: number;
}

export interface ExecutionResult {
  executionId: string;
  status: 'accepted' | 'running' | 'completed' | 'failed' | 'unavailable';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number | null;
  message?: string;
  tests?: { passed: number; failed: number; total: number };
}

export interface ExecutionProvider {
  readonly id: string;
  readonly supportedLanguages: readonly ProgrammingLanguage[];
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

export class ExecutionUnavailableError extends Error {
  constructor(message = 'Code execution is not configured for this project yet.') {
    super(message);
    this.name = 'ExecutionUnavailableError';
  }
}
