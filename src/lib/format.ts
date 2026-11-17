import { MONTHS } from './date.ts';

export function formatNumber(value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function money(value: number): string {
  return `${formatNumber(value, 2)} ₺`;
}

export function money0(value: number): string {
  return `${formatNumber(value, 0)} ₺`;
}

export function percent(value: number): string {
  return `%${formatNumber(value, value % 1 === 0 ? 0 : 1)}`;
}

export function duration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (!h) return `${m} dk`;
  if (!m) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export function shortDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (!m) return `${h}s`;
  if (!h) return `${m}dk`;
  return `${h}s ${m}dk`;
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function parseNumberText(text: string): number {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!clean) return 0;
  const value = Number(clean);
  return Number.isFinite(value) ? value : 0;
}

export function numberText(value: number): string {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? '0' : '';
  return String(value).replace('.', ',');
}
