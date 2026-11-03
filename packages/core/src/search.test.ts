import { describe, expect, it } from 'vitest';
import { normalizeSearchQuery } from './search.js';

describe('normalizeSearchQuery', () => {
  it('trims a search query and accepts the inclusive character limit', () => {
    expect(normalizeSearchQuery('  orchid care  ')).toBe('orchid care');
    expect(normalizeSearchQuery('x'.repeat(200))).toBe('x'.repeat(200));
  });

  it('rejects blank and overlong queries using Unicode code points', () => {
    expect(normalizeSearchQuery(' \t\n')).toBeUndefined();
    expect(normalizeSearchQuery('x'.repeat(201))).toBeUndefined();
    expect(normalizeSearchQuery('🪴'.repeat(200))).toBe('🪴'.repeat(200));
    expect(normalizeSearchQuery('🪴'.repeat(201))).toBeUndefined();
  });
});
