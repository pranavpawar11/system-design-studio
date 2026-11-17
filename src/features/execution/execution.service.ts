import type { ExecutionProvider, ExecutionRequest, ExecutionResult } from './execution.types';
import { ExecutionUnavailableError } from './execution.types';

let provider: ExecutionProvider | null = null;

/** Register a trusted server-backed provider at application bootstrap when one is configured. */
export function registerExecutionProvider(next: ExecutionProvider | null): void {
  provider = next;
}

export function getExecutionCapabilities() {
  return provider
    ? { available: true, provider: provider.id, supportedLanguages: [...provider.supportedLanguages] }
    : { available: false, provider: null, supportedLanguages: [] as string[] };
}

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  if (!provider) throw new ExecutionUnavailableError();
  if (!provider.supportedLanguages.includes(request.language)) {
    throw new ExecutionUnavailableError(`The configured execution provider does not support ${request.language}.`);
  }
  return provider.execute(request);
}
