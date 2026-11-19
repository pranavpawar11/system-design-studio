import { describe, it, expect, beforeEach } from 'vitest';
import { LocalApi } from '../api/local/LocalApi';
import { HttpApi } from '../api/http/HttpApi';
import { createMockFetch } from '../api/testing/mockServer';
import { ApiError, type ApiClient, type ArchitectureDocument } from '../api/contracts';
import solved from './fixtures/url-shortener-solved.json';

const URL_ID = 'hld-url-shortener-001'; const RL_ID = 'hld-rate-limiter-001'; const POLL_ID = 'hld-polls-001';
const doc = () => structuredClone(solved) as unknown as ArchitectureDocument;
const makers: [string, () => ApiClient][] = [
  ['LocalApi', () => new LocalApi()],
  ['HttpApi against the mock REST server', () => new HttpApi({ baseUrl: '/api/v1', fetchImpl: createMockFetch(new LocalApi()) })],
];

describe.each(makers)('ApiClient contract: %s', (_name, make) => {
  let api: ApiClient;
  beforeEach(() => { localStorage.clear(); api = make(); });

  it('lists every shipped question and returns a full question and its learning content', async () => {
    const list = await api.listQuestions();
    expect(list.map((q) => q.id)).toEqual([POLL_ID, URL_ID, RL_ID]);
    const q = await api.getQuestion(URL_ID);
    expect(q.question.id).toBe(URL_ID); expect(q.componentCatalogue.components.length).toBeGreaterThan(10);
    expect((await api.getLearning(RL_ID)).followUpQuestions.length).toBe(3);
  });
  it('reports an unknown question as NOT_FOUND', async () => {
    await expect(api.getQuestion('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('round-trips a draft: none → ok → none', async () => {
    expect((await api.getDraft(URL_ID)).status).toBe('none');
    await api.saveDraft(URL_ID, { doc: doc(), hints: ['HINT-01'], answers: { a: { text: 'x', covered: [0], revealed: true } } });
    const r = await api.getDraft(URL_ID);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') { expect(r.draft.doc.nodes).toHaveLength(6); expect(r.draft.hints).toEqual(['HINT-01']); expect(r.draft.answers.a.covered).toEqual([0]); }
    await api.deleteDraft(URL_ID);
    expect((await api.getDraft(URL_ID)).status).toBe('none');
  });
  it('keeps drafts separate per question', async () => {
    await api.saveDraft(URL_ID, { doc: doc(), hints: [], answers: {} });
    expect((await api.getDraft(RL_ID)).status).toBe('none');
  });
  it('creates, lists and deletes snapshots, naming unnamed ones', async () => {
    const a = await api.createSnapshot(URL_ID, { name: 'First try', doc: doc() });
    const b = await api.createSnapshot(URL_ID, { name: '   ', doc: doc() });
    expect(a.id).toBeTruthy(); expect(b.name).toBe('Snapshot 2');
    expect((await api.listSnapshots(URL_ID)).map((s) => s.name)).toEqual(['First try', 'Snapshot 2']);
    await api.deleteSnapshot(URL_ID, a.id);
    expect((await api.listSnapshots(URL_ID)).map((s) => s.id)).toEqual([b.id]);
  });
  it('enforces the 20-snapshot limit with a clear error', async () => {
    for (let i = 0; i < 20; i++) await api.createSnapshot(URL_ID, { name: `s${i}`, doc: doc() });
    await expect(api.createSnapshot(URL_ID, { name: 'one more', doc: doc() })).rejects.toThrow(/limit/i);
  });
  it('stores and clears an interview session', async () => {
    expect(await api.getInterview(URL_ID)).toBeNull();
    await api.saveInterview(URL_ID, { startedAt: 1000, durationMs: 60000, validations: 2 });
    expect(await api.getInterview(URL_ID)).toMatchObject({ startedAt: 1000, durationMs: 60000, validations: 2 });
    await api.deleteInterview(URL_ID); expect(await api.getInterview(URL_ID)).toBeNull();
  });
  it('evaluates a design deterministically', async () => {
    const r = await api.evaluate(URL_ID, { doc: doc() });
    expect(r.requirements.find((x) => x.requirementId === 'FR-01')?.status).toBe('pass');
    expect(r.limitations.length).toBeGreaterThan(0);
  });
  it('creates a share link that resolves back to the same design', async () => {
    const { url } = await api.createShareLink(URL_ID, doc());
    const u = new URL(url);
    const back = await api.resolveShare({ hash: u.hash, pathname: u.pathname });
    expect(back?.questionId).toBe(URL_ID); expect(back?.doc).toEqual(doc());
  });
  it('serves the roadmap and a lesson, and reports a missing lesson as NOT_FOUND', async () => {
    const r = await api.getRoadmap(); expect(r.nodes.length).toBeGreaterThanOrEqual(10);
    const l = await api.getLesson('cache-hit-ratio'); expect(l.lab?.inputs.length).toBeGreaterThan(2); expect(l.quiz?.questions).toHaveLength(3);
    await expect(api.getLesson('dns')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('records progress as events in order, and resets it', async () => {
    expect(await api.getProgress()).toEqual([]);
    const a = await api.recordProgress({ nodeId: 'cache-basics', type: 'quiz_passed', score: 1 });
    await api.recordProgress({ nodeId: 'cache-hit-ratio', type: 'lab_completed' });
    expect(a.at).toMatch(/^\d{4}-/);
    expect((await api.getProgress()).map((e) => `${e.nodeId}:${e.type}`)).toEqual(['cache-basics:quiz_passed', 'cache-hit-ratio:lab_completed']);
    await api.resetProgress(); expect(await api.getProgress()).toEqual([]);
  });
  it('records only the first view of a lesson', async () => {
    await api.recordProgress({ nodeId: 'cache-basics', type: 'lesson_viewed' }); await api.recordProgress({ nodeId: 'cache-basics', type: 'lesson_viewed' });
    expect(await api.getProgress()).toHaveLength(1);
  });
  it('rejects progress for unknown lessons, unknown types and bad scores', async () => {
    await expect(api.recordProgress({ nodeId: 'ghost', type: 'quiz_passed' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(api.recordProgress({ nodeId: 'cache-basics', type: 'cheated' as never })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(api.recordProgress({ nodeId: 'cache-basics', type: 'quiz_passed', score: 2 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await api.getProgress()).toEqual([]);
  });
  it('returns null when a location holds no share link', async () => {
    expect(await api.resolveShare({ hash: '', pathname: '/' })).toBeNull();
  });
});

describe('HttpApi error handling and transport', () => {
  const http = (fetchImpl: typeof fetch, extra = {}) => new HttpApi({ baseUrl: '/api/v1', fetchImpl, ...extra });
  const reply = (status: number, body?: unknown) => (async () => new Response(body === undefined ? null : JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('maps a network failure to NETWORK_ERROR with advice', async () => {
    const e = await http((async () => { throw new TypeError('offline'); }) as unknown as typeof fetch).listQuestions().catch((x) => x);
    expect(e).toBeInstanceOf(ApiError); expect(e).toMatchObject({ code: 'NETWORK_ERROR' }); expect(e.message).toMatch(/connection/);
  });
  it('maps an aborted request to TIMEOUT', async () => {
    const f = (async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }) as unknown as typeof fetch;
    await expect(http(f).listQuestions()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
  it('reads problem+json errors from the server, including details', async () => {
    const e = await http(reply(422, { code: 'VALIDATION_FAILED', message: 'Bad design.', details: ['Edge e1 is invalid.'] })).evaluate(URL_ID, { doc: doc() }).catch((x) => x);
    expect(e).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', details: ['Edge e1 is invalid.'] });
  });
  it('falls back to a status-based code when the body is not JSON', async () => {
    await expect(http(reply(401)).listQuestions()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    await expect(http(reply(429)).listQuestions()).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(http(reply(503)).listQuestions()).rejects.toMatchObject({ code: 'SERVER_ERROR' });
  });
  it('sends the bearer token and JSON body', async () => {
    let seen: RequestInit | undefined;
    const f = (async (_u: unknown, init?: RequestInit) => { seen = init; return new Response(null, { status: 204 }); }) as unknown as typeof fetch;
    await http(f, { getToken: async () => 'tok123' }).saveDraft(URL_ID, { doc: doc(), hints: [], answers: {} });
    expect((seen!.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    expect((seen!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(seen!.method).toBe('PUT');
  });
  it('treats a 422 draft as corrupt rather than throwing', async () => {
    const r = await http(reply(422, { details: ['Duplicate node ID n1.'] })).getDraft(URL_ID);
    expect(r).toEqual({ status: 'corrupt', errors: ['Duplicate node ID n1.'] });
  });
  it('encodes ids in URLs', async () => {
    let url = '';
    const f = (async (u: string) => { url = u; return new Response(JSON.stringify({}), { status: 200 }); }) as unknown as typeof fetch;
    await http(f).getQuestion('a/b c');
    expect(url).toBe('/api/v1/questions/a%2Fb%20c');
  });
});
