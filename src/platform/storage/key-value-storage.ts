/** Minimal storage contract so domains do not depend directly on browser localStorage. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Safe browser adapter. All operations degrade gracefully when storage is unavailable. */
export const browserStorage: KeyValueStorage = {
  getItem(key) {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {
      // Storage can be disabled or full; the in-memory store remains usable.
    }
  },
  removeItem(key) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      // Storage can be disabled; removal is best-effort.
    }
  },
};
