import type { ArchitectureDocument } from '../features/architecture/architecture.types';
import type { Interview, Snapshot } from '../features/architecture/session.types';
import type { QuestionSpec } from '../features/questions/question.types';
import type { EvaluationReport, Workload } from '../features/evaluation/evaluation.types';

export type { Interview, Snapshot, QuestionSpec, EvaluationReport, ArchitectureDocument, Workload };

/** What the learner has typed into a follow-up question. */
export interface Answer { text: string; covered: number[]; revealed: boolean }
export type Answers = Record<string, Answer>;

export interface QuestionSummary { id: string; title: string; difficulty: string; estimatedMinutes?: number }

export interface Learning {
  followUpQuestions: { id: string; difficulty: string; category: string; prompt: string; expectedAnswerPoints: string[] }[];
  referenceSolutions: { id: string; name: string; difficulty: string; architecture: ArchitectureDocument; flows: { name: string; steps: string[] }[]; strengths: string[]; limitations: string[]; tradeoffs: string[] }[];
  revisionRecommendations: { requirementIds: string[]; text: string }[];
}

/** The learner's in-progress work on one question. */
export interface Draft { doc: ArchitectureDocument; hints: string[]; answers: Answers; savedAt?: string }
export type DraftResult = { status: 'none' } | { status: 'ok'; draft: Draft } | { status: 'corrupt'; errors: string[] };

export interface SharedDesign { questionId: string; doc: unknown }
/** The browser location a share link is read from. Local mode reads the hash; HTTP mode reads /s/{id}. */
export interface ShareRef { hash: string; pathname: string }
export interface ShareLink { url: string }

/** Machine-readable error codes the UI can rely on. Servers should return the same codes. */
export type ApiErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'STORAGE_UNAVAILABLE' | 'INVALID_SHARE' | 'SERVER_ERROR';
export class ApiError extends Error {
  readonly status: number; readonly code: ApiErrorCode; readonly details?: string[];
  constructor(status: number, code: ApiErrorCode, message: string, details?: string[]) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; this.details = details; }
}

/**
 * Everything the front end needs from a back end. The UI and store depend ONLY on this interface.
 * `LocalApi` (browser storage and bundled data) and `HttpApi` (REST) both implement it.
 */
export interface ApiClient {
  readonly kind: 'local' | 'http';
  /** Wording for the save indicator: "Saved locally", "Saved to your account". */
  readonly savedLabel: string;

  listQuestions(): Promise<QuestionSummary[]>;
  getQuestion(questionId: string): Promise<QuestionSpec>;
  getLearning(questionId: string): Promise<Learning>;

  getDraft(questionId: string): Promise<DraftResult>;
  saveDraft(questionId: string, draft: Draft): Promise<void>;
  deleteDraft(questionId: string): Promise<void>;

  listSnapshots(questionId: string): Promise<Snapshot[]>;
  createSnapshot(questionId: string, input: { name: string; doc: ArchitectureDocument }): Promise<Snapshot>;
  deleteSnapshot(questionId: string, snapshotId: string): Promise<void>;

  getInterview(questionId: string): Promise<Interview | null>;
  saveInterview(questionId: string, interview: Interview): Promise<void>;
  deleteInterview(questionId: string): Promise<void>;

  /** Deterministic evaluation of a design. A server may run the same rules, or richer ones. */
  evaluate(questionId: string, input: { doc: ArchitectureDocument; workload?: Workload }): Promise<EvaluationReport>;

  createShareLink(questionId: string, doc: ArchitectureDocument): Promise<ShareLink>;
  /** Returns null when the location holds no share link. Throws ApiError for broken or unknown links. */
  resolveShare(ref: ShareRef): Promise<SharedDesign | null>;
}
