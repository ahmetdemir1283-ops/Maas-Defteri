export const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export const MONTHS_SHORT = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

export const WEEKDAYS = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
];

export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromKey(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
}

export function todayKey(): string {
  return toKey(new Date());
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

export function isValidDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(year: number, month: number, amount: number): { year: number; month: number } {
  const total = year * 12 + month + amount;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** Hafta pazartesi başlar. weeklyWorkDays 7 ise tatil günü yoktur. */
export function isRestDay(date: Date, weeklyWorkDays: number): boolean {
  const index = (date.getDay() + 6) % 7;
  return index >= weeklyWorkDays;
}

export function diffDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function dateRange(start: string, end: string, maxDays = 400): string[] {
  if (!isValidDayKey(start) || !isValidDayKey(end) || end < start) return [];
  const out: string[] = [];
  let cursor = fromKey(start);
  const last = fromKey(end);
  let guard = 0;
  while (cursor <= last && guard < maxDays) {
    out.push(toKey(cursor));
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

export function parseHM(value: string | undefined): number | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function minutesToHM(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (!h) return `${m} dk`;
  if (!m) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export function minutesToShort(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (!m) return `${h}s`;
  if (!h) return `${m}dk`;
  return `${h}s ${m}dk`;
}

export interface ServiceBreakdown {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalMonths: number;
}

/** Kıdem/ihbar hesaplarında kullanılan takvim farkı. */
export function serviceBreakdown(start: string, end: string): ServiceBreakdown {
  const a = fromKey(start);
  const b = fromKey(end);
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(b.getFullYear(), b.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (b < a) {
    years = 0;
    months = 0;
    days = 0;
  }
  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    totalDays: Math.max(0, diffDays(a, b)),
    totalMonths: Math.max(0, years * 12 + months),
  };
}

export function fullDateLabel(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${WEEKDAYS[(d.getDay() + 6) % 7]}`;
}

export function shortDateLabel(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
