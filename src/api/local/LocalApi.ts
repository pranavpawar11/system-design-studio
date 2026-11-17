import { ApiError, type Lesson, type ProgressEvent, type ProgressEventType, type Roadmap, type ApiClient, type Draft, type DraftResult, type Interview, type Learning, type QuestionSpec, type QuestionSummary, type ShareLink, type ShareRef, type SharedDesign, type Snapshot, type Workload, type ArchitectureDocument, type EvaluationReport } from '../contracts';
import { evaluate, DEFAULT_WORKLOAD } from '../../features/evaluation/evaluator';
import { catalogGet, catalogList } from './questionCatalog';
import { catalogHasNode, catalogLesson, catalogRoadmap } from './learningCatalog';
import { encodeShare, parseShare } from './shareCodec';
import { readProgress, writeProgress, removeProgress, readDraft, writeDraft, removeDraft, readSnapshots, writeSnapshots, readInterview, writeInterview, removeInterview } from './storage';

const MAX_SNAPSHOTS = 20;
const id = () => `snap_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
const wrap = (e: unknown): never => { throw e instanceof ApiError ? e : new ApiError(0, 'STORAGE_UNAVAILABLE', 'Browser storage is unavailable or full.'); };

/**
 * A stand-in for the back end that keeps everything in the browser. Writes happen before the optional
 * simulated delay so behaviour stays predictable; set VITE_API_LATENCY_MS to feel real network timing.
 */
export class LocalApi implements ApiClient {
  readonly kind = 'local' as const;
  readonly savedLabel = 'Saved locally';
  private readonly latencyMs: number;
  constructor(latencyMs = 0) { this.latencyMs = latencyMs; }
  private async settle() { if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs)); }

  async listQuestions(): Promise<QuestionSummary[]> { await this.settle(); return catalogList(); }
  async getQuestion(questionId: string): Promise<QuestionSpec> { await this.settle(); return catalogGet(questionId).spec; }
  async getLearning(questionId: string): Promise<Learning> { await this.settle(); return catalogGet(questionId).learning; }

  async getDraft(questionId: string): Promise<DraftResult> { const r = readDraft(catalogGet(questionId).spec); await this.settle(); return r; }
  async saveDraft(questionId: string, draft: Draft): Promise<void> { try { writeDraft(catalogGet(questionId).spec, draft); } catch (e) { wrap(e); } await this.settle(); }
  async deleteDraft(questionId: string): Promise<void> { removeDraft(catalogGet(questionId).spec); await this.settle(); }

  async listSnapshots(questionId: string): Promise<Snapshot[]> { const r = readSnapshots(catalogGet(questionId).spec); await this.settle(); return r; }
  async createSnapshot(questionId: string, input: { name: string; doc: ArchitectureDocument }): Promise<Snapshot> {
    const q = catalogGet(questionId).spec; const list = readSnapshots(q);
    if (list.length >= MAX_SNAPSHOTS) throw new ApiError(409, 'VALIDATION_FAILED', `Snapshot limit reached (${MAX_SNAPSHOTS}). Delete one first.`);
    const snap: Snapshot = { id: id(), name: input.name.trim() || `Snapshot ${list.length + 1}`, createdAt: new Date().toISOString(), doc: structuredClone(input.doc) };
    try { writeSnapshots(q, [...list, snap]); } catch (e) { wrap(e); }
    await this.settle(); return snap;
  }
  async deleteSnapshot(questionId: string, snapshotId: string): Promise<void> { const q = catalogGet(questionId).spec; writeSnapshots(q, readSnapshots(q).filter((s) => s.id !== snapshotId)); await this.settle(); }

  async getInterview(questionId: string): Promise<Interview | null> { const r = readInterview(catalogGet(questionId).spec); await this.settle(); return r; }
  async saveInterview(questionId: string, interview: Interview): Promise<void> { try { writeInterview(catalogGet(questionId).spec, interview); } catch (e) { wrap(e); } await this.settle(); }
  async deleteInterview(questionId: string): Promise<void> { removeInterview(catalogGet(questionId).spec); await this.settle(); }

  async evaluate(questionId: string, input: { doc: ArchitectureDocument; workload?: Workload }): Promise<EvaluationReport> {
    const r = evaluate(catalogGet(questionId).spec, input.doc, input.workload ?? DEFAULT_WORKLOAD); await this.settle(); return r;
  }

  async getRoadmap(): Promise<Roadmap> { await this.settle(); return catalogRoadmap(); }
  async getLesson(lessonId: string): Promise<Lesson> { const l = catalogLesson(lessonId); await this.settle(); return l; }
  async getProgress(): Promise<ProgressEvent[]> { const r = readProgress(); await this.settle(); return r; }
  async recordProgress(e: { nodeId: string; type: ProgressEventType; score?: number }): Promise<ProgressEvent> {
    if (!['lesson_viewed', 'lesson_read', 'lab_completed', 'quiz_passed'].includes(e.type)) throw new ApiError(400, 'VALIDATION_FAILED', `Unknown progress type “${e.type}”.`);
    if (!catalogHasNode(e.nodeId)) throw new ApiError(404, 'NOT_FOUND', `Lesson “${e.nodeId}” is not on the roadmap.`);
    if (e.score !== undefined && !(e.score >= 0 && e.score <= 1)) throw new ApiError(400, 'VALIDATION_FAILED', 'Score must be between 0 and 1.');
    const list = readProgress(); const event: ProgressEvent = { nodeId: e.nodeId, type: e.type, ...(e.score === undefined ? {} : { score: e.score }), at: new Date().toISOString() };
    if (e.type === 'lesson_viewed' && list.some((x) => x.nodeId === e.nodeId && x.type === 'lesson_viewed')) return list.find((x) => x.nodeId === e.nodeId && x.type === 'lesson_viewed')!; // first view only
    try { writeProgress([...list, event]); } catch (err) { wrap(err); }
    await this.settle(); return event;
  }
  async resetProgress(): Promise<void> { removeProgress(); await this.settle(); }

  async createShareLink(questionId: string, doc: ArchitectureDocument): Promise<ShareLink> {
    try { const payload = await encodeShare(questionId, doc); return { url: `${window.location.origin}${window.location.pathname}#share=${payload}` }; }
    catch (e) { throw new ApiError(413, 'VALIDATION_FAILED', (e as Error).message); }
  }
  async resolveShare(ref: ShareRef): Promise<SharedDesign | null> {
    if (!ref.hash.startsWith('#share=')) return null;
    try { const p = await parseShare(ref.hash.slice(7)); return { questionId: p.questionId, doc: p.doc }; }
    catch (e) { throw new ApiError(400, 'INVALID_SHARE', (e as Error).message); }
  }
}
