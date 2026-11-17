import { ApiError, type ApiClient, type ApiErrorCode, type ArchitectureDocument, type Lesson, type ProgressEvent, type ProgressEventType, type Roadmap, type Draft, type DraftResult, type EvaluationReport, type Interview, type Learning, type QuestionSpec, type QuestionSummary, type ShareLink, type ShareRef, type SharedDesign, type Snapshot, type Workload } from '../contracts';

export interface HttpApiOptions {
  /** e.g. "/api/v1" or "https://api.example.com/v1" */
  baseUrl: string;
  /** Return a bearer token, or null for anonymous requests. */
  getToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const CODES: Record<number, ApiErrorCode> = { 400: 'VALIDATION_FAILED', 401: 'UNAUTHORIZED', 403: 'UNAUTHORIZED', 404: 'NOT_FOUND', 409: 'VALIDATION_FAILED', 413: 'VALIDATION_FAILED', 422: 'VALIDATION_FAILED', 429: 'RATE_LIMITED' };

/** REST implementation of ApiClient. Endpoint list: docs/API.md and docs/openapi.yaml. */
export class HttpApi implements ApiClient {
  readonly kind = 'http' as const;
  readonly savedLabel = 'Saved to your account';
  private readonly o: Required<Pick<HttpApiOptions, 'baseUrl' | 'timeoutMs'>> & HttpApiOptions;
  constructor(options: HttpApiOptions) { this.o = { timeoutMs: 15000, ...options }; }

  private async raw(method: string, path: string, body?: unknown): Promise<Response> {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json, application/problem+json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = await this.o.getToken?.(); if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await (this.o.fetchImpl ?? fetch)(`${this.o.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal, credentials: 'include' });
    } catch (e) {
      throw (e as Error).name === 'AbortError' ? new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Try again.') : new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
    } finally { clearTimeout(timer); }
  }
  private async fail(r: Response): Promise<never> {
    let p: { code?: string; message?: string; details?: string[] } = {};
    try { p = await r.json(); } catch { /* not JSON */ }
    throw new ApiError(r.status, (p.code as ApiErrorCode) ?? CODES[r.status] ?? 'SERVER_ERROR', p.message ?? `The server returned ${r.status}.`, p.details);
  }
  private async json<T>(method: string, path: string, body?: unknown): Promise<T> { const r = await this.raw(method, path, body); if (!r.ok) await this.fail(r); return (r.status === 204 ? undefined : await r.json()) as T; }
  private async none(method: string, path: string, body?: unknown): Promise<void> { const r = await this.raw(method, path, body); if (!r.ok && r.status !== 404) await this.fail(r); }
  private q = (id: string) => `/questions/${encodeURIComponent(id)}`;

  listQuestions() { return this.json<QuestionSummary[]>('GET', '/questions'); }
  getQuestion(id: string) { return this.json<QuestionSpec>('GET', this.q(id)); }
  getLearning(id: string) { return this.json<Learning>('GET', `${this.q(id)}/learning`); }

  async getDraft(id: string): Promise<DraftResult> {
    const r = await this.raw('GET', `${this.q(id)}/draft`);
    if (r.status === 404) return { status: 'none' };
    if (r.status === 422) { const p = await r.json().catch(() => ({})); return { status: 'corrupt', errors: p.details ?? [p.message ?? 'The saved draft is not valid.'] }; }
    if (!r.ok) await this.fail(r);
    return { status: 'ok', draft: await r.json() };
  }
  saveDraft(id: string, draft: Draft) { return this.none('PUT', `${this.q(id)}/draft`, draft); }
  deleteDraft(id: string) { return this.none('DELETE', `${this.q(id)}/draft`); }

  listSnapshots(id: string) { return this.json<Snapshot[]>('GET', `${this.q(id)}/snapshots`); }
  createSnapshot(id: string, input: { name: string; doc: ArchitectureDocument }) { return this.json<Snapshot>('POST', `${this.q(id)}/snapshots`, input); }
  deleteSnapshot(id: string, snapshotId: string) { return this.none('DELETE', `${this.q(id)}/snapshots/${encodeURIComponent(snapshotId)}`); }

  async getInterview(id: string): Promise<Interview | null> { const r = await this.raw('GET', `${this.q(id)}/interview`); if (r.status === 404) return null; if (!r.ok) await this.fail(r); return r.json(); }
  saveInterview(id: string, iv: Interview) { return this.none('PUT', `${this.q(id)}/interview`, iv); }
  deleteInterview(id: string) { return this.none('DELETE', `${this.q(id)}/interview`); }

  evaluate(id: string, input: { doc: ArchitectureDocument; workload?: Workload }) { return this.json<EvaluationReport>('POST', `${this.q(id)}/evaluations`, input); }

  getRoadmap() { return this.json<Roadmap>('GET', '/learning/roadmap'); }
  getLesson(lessonId: string) { return this.json<Lesson>('GET', `/learning/lessons/${encodeURIComponent(lessonId)}`); }
  getProgress() { return this.json<ProgressEvent[]>('GET', '/learning/progress'); }
  recordProgress(e: { nodeId: string; type: ProgressEventType; score?: number }) { return this.json<ProgressEvent>('POST', '/learning/progress', e); }
  resetProgress() { return this.none('DELETE', '/learning/progress'); }

  async createShareLink(id: string, doc: ArchitectureDocument): Promise<ShareLink> {
    const r = await this.json<{ id: string; path: string }>('POST', `${this.q(id)}/shares`, { doc });
    return { url: `${window.location.origin}${r.path}` };
  }
  async resolveShare(ref: ShareRef): Promise<SharedDesign | null> {
    const m = /^\/s\/([A-Za-z0-9_-]+)\/?$/.exec(ref.pathname);
    if (!m) return null;
    return this.json<SharedDesign>('GET', `/shares/${m[1]}`);
  }
}
