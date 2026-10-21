import { daysBetween, startOfUtcDay } from './billing-math';

export const DEFAULT_THRESHOLDS = [30, 15, 7, 3, 1, 0] as const;
export const MAX_OVERDUE_REMINDERS = 8;

export type ThresholdHit =
  | { type: 'upcoming'; threshold: number; daysRemaining: number }
  | { type: 'overdue'; bucket: number; daysRemaining: number };

export function evaluateThreshold(targetDate: Date, now: Date, thresholds: readonly number[] = DEFAULT_THRESHOLDS): ThresholdHit | null {
  const daysRemaining = daysBetween(startOfUtcDay(now), targetDate);
  if (daysRemaining < 0) {
    const bucket = Math.floor((-daysRemaining - 1) / 7);
    return bucket >= MAX_OVERDUE_REMINDERS ? null : { type: 'overdue', bucket, daysRemaining };
  }
  const eligible = [...thresholds].filter((t) => t >= daysRemaining).sort((a, b) => a - b);
  return eligible.length ? { type: 'upcoming', threshold: eligible[0], daysRemaining } : null;
}

export function dedupeKey(parts: { kind: string; subjectId: string; targetDate: Date; hit: ThresholdHit }): string {
  const iso = parts.targetDate.toISOString().slice(0, 10);
  const slot = parts.hit.type === 'upcoming' ? `t${parts.hit.threshold}` : `o${parts.hit.bucket}`;
  return `${parts.kind}:${parts.subjectId}:${iso}:${slot}`;
}

export function severityFor(hit: ThresholdHit): 'info' | 'warning' | 'critical' {
  if (hit.type === 'overdue') return 'critical';
  if (hit.threshold <= 3) return 'critical';
  if (hit.threshold <= 15) return 'warning';
  return 'info';
}

export function sanitizeThresholds(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 12) return null;
  const nums = input.map((n) => (typeof n === 'number' ? n : Number.NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 365)) return null;
  return [...new Set(nums)].sort((a, b) => b - a);
}
