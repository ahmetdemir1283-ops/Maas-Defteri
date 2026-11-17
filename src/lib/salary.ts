import type { AppData, SalaryPeriod, Settings } from '../types.ts';
import { monthKey, todayKey } from './date.ts';

export function snapshotFromSettings(settings: Settings, from: string): SalaryPeriod {
  return {
    id: `salary_${from}`,
    from,
    mode: settings.salaryMode,
    basis: settings.salaryBasis,
    monthlySalary: settings.monthlySalary,
    hourlyRate: settings.hourlyRate,
    monthlyHourDivisor: settings.monthlyHourDivisor,
  };
}

export function sortPeriods(periods: SalaryPeriod[]): SalaryPeriod[] {
  return [...periods].sort((a, b) => a.from.localeCompare(b.from));
}

/** Hedef aya en yakın (o ay ve öncesinde başlayan) maaş dönemini döndürür. */
export function salaryForMonth(data: AppData, year: number, month: number): SalaryPeriod {
  const key = monthKey(year, month);
  const periods = sortPeriods(data.salaryHistory);
  if (!periods.length) return snapshotFromSettings(data.settings, key);
  let candidate = periods[0];
  for (const period of periods) {
    if (period.from <= key) candidate = period;
  }
  return candidate;
}

/** O ay için geçerli maaş alanlarını güncel ayarların üzerine bindirir. */
export function effectiveSettings(data: AppData, year: number, month: number): Settings {
  const period = salaryForMonth(data, year, month);
  return {
    ...data.settings,
    salaryMode: period.mode,
    salaryBasis: period.basis,
    monthlySalary: period.monthlySalary,
    hourlyRate: period.hourlyRate,
    monthlyHourDivisor: period.monthlyHourDivisor,
  };
}

/** Geçmiş ayları sabitlemek için ilk kayıttan itibaren bir başlangıç dönemi oluşturur. */
export function ensureSalaryHistory(data: AppData): AppData {
  if (data.salaryHistory.length) return data;
  const months = [
    ...Object.keys(data.entries).map((key) => key.slice(0, 7)),
    ...data.leaves.flatMap((leave) => [leave.start.slice(0, 7), leave.end.slice(0, 7)]),
  ]
    .filter((month) => /^\d{4}-\d{2}$/.test(month))
    .sort();
  const from = months[0] ?? todayKey().slice(0, 7);
  return { ...data, salaryHistory: [snapshotFromSettings(data.settings, from)] };
}

export function upsertSalaryPeriod(
  periods: SalaryPeriod[],
  period: SalaryPeriod,
): SalaryPeriod[] {
  const rest = periods.filter((item) => item.from !== period.from && item.id !== period.id);
  return sortPeriods([...rest, period]);
}

/** Güncel ay için geçerli dönemi ayarlara yansıtır. */
export function syncSettingsWithCurrentPeriod(data: AppData): AppData {
  if (!data.salaryHistory.length) return data;
  const now = new Date();
  const period = salaryForMonth(data, now.getFullYear(), now.getMonth());
  return {
    ...data,
    settings: {
      ...data.settings,
      salaryMode: period.mode,
      salaryBasis: period.basis,
      monthlySalary: period.monthlySalary,
      hourlyRate: period.hourlyRate,
      monthlyHourDivisor: period.monthlyHourDivisor,
    },
  };
}
