import { describe, it, expect } from 'vitest';
import { computeMetrics, dbReadRate, utilization } from '../features/evaluation/metrics';

const base = { newUrlsPerDay: 1e7, redirectsPerDay: 1e8, averageRecordBytes: 500, retentionYears: 3, peakMultiplier: 3, cacheHitRatio: 0.9 };
describe('metrics', () => {
  it('matches spec expected values', () => {
    const m = computeMetrics(base);
    expect(m.avgCreate).toBeCloseTo(115.7407407, 5);
    expect(m.peakRedirect).toBeCloseTo(3472.222222, 4);
    expect(m.rawStorageBytes).toBe(5475000000000);
    expect(m.dbReadsWithCache).toBeCloseTo(115.7407407, 5);
  });
  it('handles hit ratio boundaries and cache failure', () => {
    expect(dbReadRate(10000, 0)).toBe(10000);
    expect(dbReadRate(10000, 1)).toBe(0);
    expect(dbReadRate(10000, 0.9, false)).toBe(10000);
  });
  it('rejects invalid input', () => {
    expect(() => dbReadRate(10, 1.5)).toThrow();
    expect(() => dbReadRate(-1, 0.5)).toThrow();
    expect(() => computeMetrics({ ...base, newUrlsPerDay: -1 })).toThrow();
  });
  it('never returns Infinity/NaN for zero capacity', () => {
    expect(utilization(100, 0, 3000)).toBeNull();
  });
});
