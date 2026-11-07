import type { EvaluationReport } from '../evaluation/evaluation.types';

export interface Summary {
  validated: boolean; total: number; met: string[]; notMet: { title: string; next?: string }[]; unverified: { title: string; next?: string }[];
  hintsUsed: number; hintsTotal: number; independence: string;
  followUps: { reviewed: number; total: number; pointsCovered: number; pointsTotal: number };
  recommendations: string[]; nextStep: string;
  interview?: { minutesUsed: number; durationMinutes: number; validations: number; overtime: boolean };
}
interface Input {
  report: EvaluationReport | null; titleOf(id: string): string; hintsUsed: number; hintsTotal: number;
  followUps: { id: string; expectedAnswerPoints: string[] }[]; answers: Record<string, { revealed: boolean; covered: number[] }>;
  recommendations: { requirementIds: string[]; text: string }[];
  interview?: { startedAt: number; durationMs: number; endedAt?: number; validations: number } | null;
  now?: number;
}

/** Deterministic, explainable summary: counts and evidence only, no opaque score. */
export function buildSummary(i: Input): Summary {
  const reqs = i.report ? [...new Map(i.report.requirements.map((r) => [r.requirementId, r])).values()] : [];
  const nextFor = (id: string) => i.report?.findings.find((f) => f.requirementId === id && f.suggestion)?.suggestion;
  const met = reqs.filter((r) => r.status === 'pass').map((r) => i.titleOf(r.requirementId));
  const notMet = reqs.filter((r) => r.status === 'fail').map((r) => ({ title: i.titleOf(r.requirementId), next: nextFor(r.requirementId) }));
  const unverified = reqs.filter((r) => r.status === 'not-evaluated').map((r) => ({ title: i.titleOf(r.requirementId), next: nextFor(r.requirementId) }));
  const reviewed = i.followUps.filter((f) => i.answers[f.id]?.revealed);
  const independence = i.hintsUsed === 0 ? 'Solved without hints' : i.hintsUsed <= i.hintsTotal / 2 ? 'Used a few hints' : 'Relied on most of the hints';
  const failed = new Set(reqs.filter((r) => r.status === 'fail').map((r) => r.requirementId));
  const recommendations = i.recommendations.filter((r) => r.requirementIds.some((id) => failed.has(id))).map((r) => r.text);
  const nextStep = !i.report ? 'Click Validate to see which requirements your design meets.'
    : notMet[0] ? `Fix “${notMet[0].title}”${notMet[0].next ? `: ${notMet[0].next}` : '.'}`
    : unverified[0] ? `Verify “${unverified[0].title}”${unverified[0].next ? `: ${unverified[0].next}` : '.'}`
    : reviewed.length < i.followUps.length ? 'Your design meets every checked requirement. Work through the remaining follow-up questions.' : 'Every check is met and every follow-up is reviewed. Try a harder variation or another question.';
  return {
    validated: !!i.report, total: reqs.length, met, notMet, unverified, hintsUsed: i.hintsUsed, hintsTotal: i.hintsTotal, independence,
    followUps: { reviewed: reviewed.length, total: i.followUps.length, pointsCovered: reviewed.reduce((a, f) => a + (i.answers[f.id]?.covered.length ?? 0), 0), pointsTotal: reviewed.reduce((a, f) => a + f.expectedAnswerPoints.length, 0) },
    recommendations, nextStep,
    interview: i.interview ? (() => { const used = ((i.interview.endedAt ?? i.now ?? Date.now()) - i.interview.startedAt) / 60000; return { minutesUsed: Math.round(used * 10) / 10, durationMinutes: Math.round(i.interview.durationMs / 60000), validations: i.interview.validations, overtime: used * 60000 > i.interview.durationMs }; })() : undefined,
  };
}
