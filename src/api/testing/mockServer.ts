import { ApiError } from '../contracts';
import type { LocalApi } from '../local/LocalApi';

/**
 * An in-memory REST server that speaks the documented HTTP contract on top of LocalApi.
 * Used by contract tests so HttpApi is verified without a real back end, and as a worked example
 * of the request and response shapes a real back end must produce.
 */
export function createMockFetch(local: LocalApi, opts: { failWith?: (path: string, method: string) => Response | null } = {}): typeof fetch {
  const shares = new Map<string, { questionId: string; doc: unknown }>();
  const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? {} : { 'Content-Type': 'application/json' } });
  const problem = (e: unknown) => {
    if (e instanceof ApiError) { const status = e.status || 500; return json(status, { status, code: e.code, message: e.message, details: e.details }); }
    return json(500, { status: 500, code: 'SERVER_ERROR', message: String(e) });
  };

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://api.test'); const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, ''); const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const forced = opts.failWith?.(path, method); if (forced) return forced;
    try {
      let m: RegExpExecArray | null;
      if (method === 'GET' && path === '/questions') return json(200, await local.listQuestions());
      if ((m = /^\/questions\/([^/]+)(\/.*)?$/.exec(path))) {
        const id = decodeURIComponent(m[1]); const rest = m[2] ?? '';
        if (method === 'GET' && rest === '') return json(200, await local.getQuestion(id));
        if (method === 'GET' && rest === '/learning') return json(200, await local.getLearning(id));
        if (rest === '/draft') {
          if (method === 'GET') { const d = await local.getDraft(id); return d.status === 'none' ? json(404, { status: 404, code: 'NOT_FOUND', message: 'No draft.' }) : d.status === 'corrupt' ? json(422, { status: 422, code: 'VALIDATION_FAILED', message: 'Draft is not valid.', details: d.errors }) : json(200, d.draft); }
          if (method === 'PUT') { await local.saveDraft(id, body); return json(204); }
          if (method === 'DELETE') { await local.deleteDraft(id); return json(204); }
        }
        if (rest === '/snapshots') {
          if (method === 'GET') return json(200, await local.listSnapshots(id));
          if (method === 'POST') return json(201, await local.createSnapshot(id, body));
        }
        if ((m = /^\/snapshots\/([^/]+)$/.exec(rest)) && method === 'DELETE') { await local.deleteSnapshot(id, decodeURIComponent(m[1])); return json(204); }
        if (rest === '/interview') {
          if (method === 'GET') { const iv = await local.getInterview(id); return iv ? json(200, iv) : json(404, { status: 404, code: 'NOT_FOUND', message: 'No interview.' }); }
          if (method === 'PUT') { await local.saveInterview(id, body); return json(204); }
          if (method === 'DELETE') { await local.deleteInterview(id); return json(204); }
        }
        if (rest === '/evaluations' && method === 'POST') return json(200, await local.evaluate(id, body));
        if (rest === '/shares' && method === 'POST') { const sid = Math.random().toString(36).slice(2, 10); shares.set(sid, { questionId: id, doc: body.doc }); return json(201, { id: sid, path: `/s/${sid}` }); }
      }
      if ((m = /^\/shares\/([A-Za-z0-9_-]+)$/.exec(path)) && method === 'GET') { const s = shares.get(m[1]); return s ? json(200, s) : json(404, { status: 404, code: 'NOT_FOUND', message: 'This share link does not exist.' }); }
      return json(404, { status: 404, code: 'NOT_FOUND', message: `No route for ${method} ${path}` });
    } catch (e) { return problem(e); }
  }) as typeof fetch;
}
