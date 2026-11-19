import { describe, expect, it } from 'vitest';
import { groupQuestionFiles } from '../api/local/questionCatalog';

describe('question evaluation sidecar discovery', () => {
  it('groups evaluation sidecars with their question instead of treating them as questions', () => {
    const spec = { question: { id: 'hld-example-001' } };
    const learning = { followUpQuestions: [] };
    const extensions = { components: [] };
    const evaluation = { schemaVersion: 1, questionId: 'hld-example-001' };
    const groups = groupQuestionFiles({
      '../../data/questions/example.json': spec,
      '../../data/questions/example.learning.json': learning,
      '../../data/questions/example.extensions.json': extensions,
      '../../data/questions/example.evaluation.json': evaluation,
    });

    expect(groups.size).toBe(1);
    expect(groups.get('example')).toEqual({ spec, learning, ext: extensions, evaluation });
  });

  it('does not invent a question when only a sidecar exists', () => {
    const groups = groupQuestionFiles({
      '../../data/questions/orphan.evaluation.json': { schemaVersion: 1 },
    });
    expect(groups.get('orphan')).toEqual({ evaluation: { schemaVersion: 1 } });
    expect(groups.get('orphan')?.spec).toBeUndefined();
  });
});
