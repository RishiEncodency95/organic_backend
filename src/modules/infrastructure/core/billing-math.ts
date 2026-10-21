export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';

const DAY_MS = 86_400_000;

export function utcDate(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day));
}

export function startOfUtcDay(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS);
}

export function cycleMonths(cycle: BillingCycle, customIntervalMonths?: number | null): number | null {
  switch (cycle) {
    case 'MONTHLY': return 1;
    case 'QUARTERLY': return 3;
    case 'HALF_YEARLY': return 6;
    case 'YEARLY': return 12;
    case 'CUSTOM': return customIntervalMonths && customIntervalMonths > 0 && Number.isInteger(customIntervalMonths) ? customIntervalMonths : null;
  }
}
export function addMonths(date: Date, months: number, anchorDay?: number | null): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const wanted = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : date.getUTCDate();
  return utcDate(year, month0, Math.min(wanted, daysInMonth(year, month0)));
}

export function nextCycleDate(due: Date, cycle: BillingCycle, customIntervalMonths?: number | null, anchorDay?: number | null): Date | null {
  const months = cycleMonths(cycle, customIntervalMonths);
  return months === null ? null : addMonths(due, months, anchorDay ?? due.getUTCDate());
}

export function monthlyEquivalent(amount: number | null, cycle: BillingCycle, customIntervalMonths?: number | null): number | null {
  const months = cycleMonths(cycle, customIntervalMonths);
  if (amount === null || months === null) return null;
  return Math.round((amount * 100) / months) / 100;
}

export function projectOccurrences(nextDue: Date, cycle: BillingCycle, customIntervalMonths: number | null | undefined, from: Date, to: Date, anchorDay?: number | null, cap = 400): Date[] {
  const months = cycleMonths(cycle, customIntervalMonths);
  if (months === null) return [];
  const anchor = anchorDay ?? nextDue.getUTCDate();
  const out: Date[] = [];
  for (let i = 0; i < cap; i += 1) {
    const d = addMonths(nextDue, months * i, anchor);
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

export type DueBucket = 'overdue' | 'today' | 'within7' | 'within15' | 'within30' | 'within60' | 'within90' | 'later';

export function dueBucket(daysRemaining: number): DueBucket {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining === 0) return 'today';
  if (daysRemaining <= 7) return 'within7';
  if (daysRemaining <= 15) return 'within15';
  if (daysRemaining <= 30) return 'within30';
  if (daysRemaining <= 60) return 'within60';
  if (daysRemaining <= 90) return 'within90';
  return 'later';
}

export function sumMoney(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v == null ? 0 : Math.round(v * 100)), 0) / 100;
}
