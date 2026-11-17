import { useMemo, useSyncExternalStore } from 'react';

export type Route =
  | { name: 'studio' }
  | { name: 'learn' }
  | { name: 'lesson'; id: string }
  | { name: 'lld' }
  | { name: 'lld-lesson'; id: string };
export const links = {
  studio: '#/',
  learn: '#/learn',
  lesson: (id: string) => `#/learn/lesson/${encodeURIComponent(id)}`,
  lldLearn: '#/learn/lld',
  lldLesson: (id: string) => `#/learn/lld/lesson/${encodeURIComponent(id)}`,
};

/** Hash routes keep this a static site. A share link (#share=…) is not a route and opens the Studio. */
export function parseRoute(hash: string): Route {
  const lldLesson = /^#\/learn\/lld\/lesson\/([^/?]+)\/?$/.exec(hash);
  if (lldLesson) return { name: 'lld-lesson', id: decodeURIComponent(lldLesson[1]) };
  if (/^#\/learn\/lld\/?$/.test(hash)) return { name: 'lld' };
  const lesson = /^#\/learn\/lesson\/([^/?]+)\/?$/.exec(hash);
  if (lesson) return { name: 'lesson', id: decodeURIComponent(lesson[1]) };
  if (/^#\/learn\/?$/.test(hash)) return { name: 'learn' };
  return { name: 'studio' };
}
const subscribe = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
export function useRoute(): Route { const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => ''); return useMemo(() => parseRoute(hash), [hash]); }
