import { describe, it, expect } from 'vitest';
import spec from '../data/questions/url-shortener.json';
import ext from '../data/questions/url-shortener.extensions.json';
import solved2 from './fixtures/url-shortener-solved-v2.json';
import { mergeExtensions, parseQuestion } from '../features/questions/questionLoader';
import { validateDocument } from '../features/architecture/architecture.utils';
import { evaluate } from '../features/evaluation/evaluator';

describe('catalogue extensions', () => {
  it('make an original-style base JSON (without new components) import the full design', () => {
    const base = structuredClone(spec) as typeof spec;
    const newIds = ext.components.map((c) => c.id);
    base.componentCatalogue.components = base.componentCatalogue.components.filter((c) => !newIds.includes(c.id));
    base.componentCatalogue.allowedComponentIds = base.componentCatalogue.allowedComponentIds.filter((i) => !newIds.includes(i));
    base.connectionTypes = base.connectionTypes.filter((c) => !ext.connectionTypes.some((e) => e.id === c.id));
    const q = mergeExtensions(parseQuestion(base), ext as never);
    expect(validateDocument(solved2, q).ok).toBe(true);
    // idempotent
    expect(mergeExtensions(q, ext as never).componentCatalogue.components.length).toBe(q.componentCatalogue.components.length);
  });
  it('requirements carry evidence node IDs for highlighting', () => {
    const q = mergeExtensions(parseQuestion(spec), ext as never);
    const r = validateDocument(solved2, q); if (!r.ok) throw new Error('invalid');
    const fr2 = evaluate(q, r.doc).requirements.find((x) => x.requirementId === 'FR-02')!;
    expect(fr2.status).toBe('pass'); expect(fr2.evidenceNodeIds).toContain('app');
  });
});
