import type { Lesson, Roadmap } from '../../features/learning/types';

export class LearningApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'LearningApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface LearningApiOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface RoadmapResponse {
  track: string;
  version: number;
  publishedAt: string;
  roadmap: Roadmap;
}
interface PracticeCatalogueResponse {
  track: string;
  version: number;
  publishedAt: string;
  catalogue: unknown;
}
interface LessonResponse {
  track: string;
  id: string;
  version: number;
  publishedAt: string;
  lesson: Lesson;
}

/**
 * Isolated learner-content API. It deliberately does not participate in the
 * global Studio ApiClient selection.
 */
export class LearningContentApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: LearningApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    // Keep the browser's required Window receiver when invoking fetch.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'include',
      });
      if (!response.ok) {
        let payload: { error?: { code?: string; message?: string }; message?: string } = {};
        try { payload = await response.json(); } catch { /* response may not be JSON */ }
        const message = payload.error?.message ?? payload.message ??
          (response.status === 404
            ? 'This learning content is not available yet.'
            : `Learning service returned ${response.status}.`);
        throw new LearningApiError(message, response.status, payload.error?.code);
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('The learning service took too long to respond.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async getRoadmap(track: string): Promise<Roadmap> {
    const result = await this.get<RoadmapResponse>(
      `/learning/${encodeURIComponent(track)}/roadmap`,
    );
    return result.roadmap;
  }

  async getPracticeCatalogue<T = unknown>(track: string): Promise<T> {
    const result = await this.get<PracticeCatalogueResponse>(
      `/learning/${encodeURIComponent(track)}/practice-catalogue`,
    );
    return result.catalogue as T;
  }

  async getLesson(track: string, lessonId: string): Promise<Lesson> {
    const result = await this.get<LessonResponse>(
      `/learning/${encodeURIComponent(track)}/lessons/${encodeURIComponent(lessonId)}`,
    );
    return result.lesson;
  }
}

const env = import.meta.env;
const baseUrl = env.VITE_LEARNING_API_BASE_URL ?? env.VITE_API_BASE_URL ?? '/api/v1';

export const learningContentApi = new LearningContentApi({ baseUrl });
