export class MetricInputError extends Error {}
const SECONDS_PER_DAY = 86400;

export interface CapacityInputs {
  newUrlsPerDay: number; redirectsPerDay: number; averageRecordBytes: number;
  retentionYears: number; peakMultiplier: number; cacheHitRatio: number;
}
const finite = (n: number, label: string) => {
  if (!Number.isFinite(n)) throw new MetricInputError(`${label} must be a finite number.`);
};
export function validateInputs(i: CapacityInputs): void {
  for (const [k, v] of Object.entries(i)) finite(v, k);
  if (i.newUrlsPerDay < 0 || i.redirectsPerDay < 0) throw new MetricInputError('Traffic cannot be negative.');
  if (i.averageRecordBytes <= 0) throw new MetricInputError('Record size must be positive.');
  if (i.retentionYears < 0) throw new MetricInputError('Retention cannot be negative.');
  if (i.peakMultiplier < 1) throw new MetricInputError('Peak multiplier must be at least 1.');
  if (i.cacheHitRatio < 0 || i.cacheHitRatio > 1) throw new MetricInputError('Cache hit ratio must be between 0 and 1.');
}
export function computeMetrics(i: CapacityInputs) {
  validateInputs(i);
  const avgCreate = i.newUrlsPerDay / SECONDS_PER_DAY;
  const avgRedirect = i.redirectsPerDay / SECONDS_PER_DAY;
  return {
    avgCreate, avgRedirect,
    peakRedirect: avgRedirect * i.peakMultiplier,
    readWriteRatio: i.newUrlsPerDay === 0 ? null : i.redirectsPerDay / i.newUrlsPerDay,
    rawStorageBytes: i.newUrlsPerDay * i.retentionYears * 365 * i.averageRecordBytes,
    dbReadsWithCache: avgRedirect * (1 - i.cacheHitRatio),
  };
}
export function dbReadRate(redirectRate: number, hitRatio: number, cacheAvailable = true): number {
  if (redirectRate < 0) throw new MetricInputError('Traffic cannot be negative.');
  if (hitRatio < 0 || hitRatio > 1 || !Number.isFinite(hitRatio)) throw new MetricInputError('Cache hit ratio must be between 0 and 1.');
  return cacheAvailable ? redirectRate * (1 - hitRatio) : redirectRate;
}
/** Returns null (not Infinity/NaN) when capacity is zero or negative. */
export function utilization(incomingRps: number, instances: number, capacityPerInstance: number): number | null {
  const total = instances * capacityPerInstance;
  return total > 0 && Number.isFinite(total) ? incomingRps / total : null;
}
