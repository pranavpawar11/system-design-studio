import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'src');
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
const app = files(root).map((p) => ({ path: relative(root, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') })).filter((f) => !f.path.startsWith('tests/'));
const outside = (allowed: (p: string) => boolean, re: RegExp) => app.filter((f) => !allowed(f.path) && re.test(f.text)).map((f) => f.path);

describe('back-end boundary', () => {
  it('only the local API reads bundled question data', () => {
    expect(outside((p) => p.startsWith('api/local/'), /data\/questions\//)).toEqual([]);
  });
  it('only the local API, device preferences and layout preferences touch browser storage', () => {
    expect(outside((p) => p.startsWith('api/local/') || ['api/preferences.ts', 'api/index.ts', 'features/architecture/architecture.store.ts'].includes(p), /localStorage|sessionStorage/)).toEqual([]);
  });
  it('the evaluator runs behind the API, never directly from the UI or store', () => {
    expect(outside((p) => p.startsWith('api/local/') || p.startsWith('features/evaluation/'), /evaluation\/evaluator['"]/)).toEqual([]);
  });
  it('nothing outside src/api calls fetch', () => {
    expect(outside((p) => p.startsWith('api/'), /\bfetch\(/)).toEqual([]);
  });
});
