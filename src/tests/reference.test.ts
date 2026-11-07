import { describe, it, expect } from 'vitest';
import spec from '../data/questions/url-shortener.json';
import ext from '../data/questions/url-shortener.extensions.json';
import learning from '../data/questions/url-shortener.learning.json';
import { mergeExtensions, parseQuestion } from '../features/questions/questionLoader';
import { validateDocument } from '../features/architecture/architecture.utils';
import { evaluate } from '../features/evaluation/evaluator';
import { compareWithReference } from '../features/reference/compare';
import type { ArchitectureDocument } from '../features/architecture/architecture.types';

const q = mergeExtensions(parseQuestion(spec), ext as never);
describe('reference solutions', () => {
  for (const r of learning.referenceSolutions) {
    it(`${r.id} is valid and satisfies the functional and durability checks`, () => {
      const v = validateDocument(r.architecture, q);
      expect(v.ok).toBe(true);
      if (!v.ok) return;
      const failed = evaluate(q, v.doc).requirements.filter((x) => x.status === 'fail').map((x) => x.requirementId);
      // REF-01 documents its own limitation: one SQL database cannot absorb 10k uncached reads/s.
      expect(failed).toEqual(r.id === 'REF-01' ? ['FR-05', 'NFR-02'] : []);
    });
  }
  it('compares component types without requiring a match', () => {
    const [a, b] = learning.referenceSolutions.map((r) => r.architecture as unknown as ArchitectureDocument);
    const c = compareWithReference(a, b);
    expect(c.missing).toContain('cache'); expect(c.shared).toContain('application-server');
  });
  it('ships all eight follow-up questions', () => expect(learning.followUpQuestions).toHaveLength(8));
});
