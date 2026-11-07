export type Severity = 'error' | 'warning' | 'info' | 'not-evaluated';
export interface Finding {
  id: string; ruleId: string; severity: Severity; title: string; explanation: string;
  requirementId?: string; nodeIds: string[]; edgeIds: string[]; suggestion?: string;
}
export type ReqStatus = 'pass' | 'fail' | 'not-evaluated';
export interface RequirementResult { requirementId: string; status: ReqStatus; findingIds: string[]; evidenceNodeIds: string[] }
export interface EvaluationReport { findings: Finding[]; requirements: RequirementResult[]; limitations: string[] }

/** Traffic assumptions an evaluation can be run against. */
export interface Workload { peakRedirectRps: number; cacheHitRatio: number }
