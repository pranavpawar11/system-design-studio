import type { ProgressEvent, ProgressEventType } from '../../features/learning/types';
import { api } from '../index';
import { useAuthStore } from '../../features/auth/authStore';

interface ProgressEnvelope { track: string; events: ProgressEvent[] }
const env = import.meta.env;
const baseUrl = (env.VITE_LEARNING_API_BASE_URL ?? env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

async function request<T>(track: string, method: string, body?: unknown): Promise<T> {
  const token = useAuthStore.getState().learnerToken;
  if (!token) throw new Error('Sign in to sync learning progress.');
  let response: Response;
  try {
    response = await globalThis.fetch(`${baseUrl}/learning/${encodeURIComponent(track)}/progress`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      credentials: 'include',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Could not connect to the learning service.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(payload.message ?? payload.error ?? `Progress request failed (${response.status}).`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const learnerProgressApi = {
  isSignedIn: () => Boolean(useAuthStore.getState().learnerToken),
  async restoreSession(): Promise<boolean> { return useAuthStore.getState().restoreLearner(); },
  async get(track: string): Promise<ProgressEvent[]> {
    await useAuthStore.getState().restoreLearner();
    if (!useAuthStore.getState().learnerToken) {
      if (track === 'hld') return api.getProgress();
      return [];
    }
    const result = await request<ProgressEnvelope>(track, 'GET');
    return result.events;
  },
  async record(track: string, event: { nodeId: string; type: ProgressEventType; score?: number }): Promise<ProgressEvent> {
    await useAuthStore.getState().restoreLearner();
    if (!useAuthStore.getState().learnerToken) {
      if (track === 'hld') return api.recordProgress(event);
      return { ...event, at: new Date().toISOString() };
    }
    return request<ProgressEvent>(track, 'POST', { ...event, clientEventId: globalThis.crypto.randomUUID() });
  },
  async reset(track: string): Promise<void> {
    await useAuthStore.getState().restoreLearner();
    if (!useAuthStore.getState().learnerToken) {
      if (track === 'hld') return api.resetProgress();
      return;
    }
    await request<void>(track, 'DELETE');
  },
};
