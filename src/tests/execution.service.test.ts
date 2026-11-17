import { afterEach, describe, expect, it } from 'vitest';
import { executeCode, getExecutionCapabilities, registerExecutionProvider } from '../features/execution/execution.service';
import { ExecutionUnavailableError } from '../features/execution/execution.types';

afterEach(() => registerExecutionProvider(null));

describe('execution provider boundary', () => {
  it('reports execution unavailable rather than simulating a result', async () => {
    expect(getExecutionCapabilities().available).toBe(false);
    await expect(executeCode({ exerciseId: 'demo', language: 'java', files: [] })).rejects.toBeInstanceOf(ExecutionUnavailableError);
  });

  it('delegates only to a configured provider that supports the selected language', async () => {
    registerExecutionProvider({
      id: 'test-provider',
      supportedLanguages: ['java'],
      async execute() {
        return { executionId: 'run-1', status: 'completed', stdout: 'ok', stderr: '', exitCode: 0, durationMs: 2 };
      },
    });
    await expect(executeCode({ exerciseId: 'demo', language: 'java', files: [] })).resolves.toMatchObject({ status: 'completed', stdout: 'ok' });
    await expect(executeCode({ exerciseId: 'demo', language: 'python', files: [] })).rejects.toBeInstanceOf(ExecutionUnavailableError);
  });
});
