import { describe, expect, it } from 'vitest';
import { links, parseRoute } from '../app/route';

describe('public route structure', () => {
  it('uses the root route for the common landing page', () => {
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('')).toEqual({ name: 'home' });
  });

  it('opens the HLD Studio workspace on its explicit route', () => {
    expect(links.studio).toBe('#/studio');
    expect(parseRoute('#/studio')).toEqual({ name: 'studio' });
  });

  it('preserves existing HLD and LLD learning routes', () => {
    expect(parseRoute('#/learn')).toEqual({ name: 'learn' });
    expect(parseRoute('#/learn/lld')).toEqual({ name: 'lld' });
    expect(parseRoute('#/learn/lld/lesson/what-is-an-object')).toEqual({
      name: 'lld-lesson',
      id: 'what-is-an-object',
    });
  });

  it('continues opening the Studio for legacy share hashes', () => {
    expect(parseRoute('#share=legacy-payload')).toEqual({ name: 'studio' });
  });
});
