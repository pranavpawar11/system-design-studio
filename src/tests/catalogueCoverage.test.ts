import { describe, expect, it } from 'vitest';
import { auditBundledEvaluationCatalogue } from '../features/evaluation/catalogueCoverage';



describe('bundled evaluation catalogue quality gate', () => {
  it('discovers every bundled HLD question and reports its fixture coverage', () => {
    const report = auditBundledEvaluationCatalogue();
    console.log(
  '\nEVALUATION CATALOGUE AUDIT:\n',
  JSON.stringify(report, null, 2)
);
    expect(report.total).toBe(3);
    expect(report.questions.map((question) => question.questionId).sort()).toEqual([
      'hld-polls-001', 'hld-rate-limiter-001', 'hld-url-shortener-001',
    ]);
    expect(report.questions.every((question) => question.status === 'ready')).toBe(true);
    expect(report.ready).toBe(3);
    expect(report.incomplete).toBe(0);
    expect(report.notSupported).toBe(0);
    expect(report.loadIssues).toEqual([]);
  });

  it('executes valid, invalid and alternative-valid fixtures for every supported question', () => {
    const report = auditBundledEvaluationCatalogue();
    for (const question of report.questions) {
      expect(question.fixtureChecks, question.questionId).toEqual({
        validDesign: true,
        invalidDesign: true,
        alternativeValidDesign: true,
      });
    }
  });
});
