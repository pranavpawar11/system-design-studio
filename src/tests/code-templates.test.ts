import { describe, expect, it } from 'vitest';
import { starterFileForLanguage } from '../features/practice/code-templates';

describe('language starter templates', () => {
  it('creates idiomatic starter files for each supported language', () => {
    expect(starterFileForLanguage('java').path).toBe('Main.java');
    expect(starterFileForLanguage('cpp').content).toContain('#include <iostream>');
    expect(starterFileForLanguage('python').content).toContain('def solve():');
  });
});
