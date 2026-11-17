import type { LegalParams } from '../types.ts';
import { clampMoney, round2 } from './payroll.ts';
import { serviceBreakdown } from './date.ts';

export interface SeveranceResult {
  service: ReturnType<typeof serviceBreakdown>;
  cappedMonthly: number;
  capped: boolean;
  gross: number;
  stampTax: number;
  net: number;
  eligible: boolean;
}

/** Kıdem tazminatı: her tam yıl için 30 günlük brüt ücret, tavanla sınırlı. */
export function calculateSeverance(input: {
  grossMonthly: number;
  start: string;
  end: string;
  legal: LegalParams;
  ceiling: number;
  stamp: boolean;
}): SeveranceResult {
  const service = serviceBreakdown(input.start, input.end);
  const cappedMonthly = Math.min(clampMoney(input.grossMonthly), clampMoney(input.ceiling));
  const yearsFraction = service.years + service.months / 12 + service.days / 365;
  const gross = clampMoney(cappedMonthly * yearsFraction);
  const stampTax = input.stamp ? gross * (input.legal.stampTax / 100) : 0;
  return {
    service,
    cappedMonthly,
    capped: input.grossMonthly > input.ceiling,
    gross: round2(gross),
    stampTax: round2(stampTax),
    net: round2(clampMoney(gross - stampTax)),
    eligible: service.totalMonths >= 12,
  };
}

export interface NoticeResult {
  service: ReturnType<typeof serviceBreakdown>;
  weeks: number;
  days: number;
  gross: number;
  stampTax: number;
  net: number;
}

/** İhbar tazminatı: kıdeme göre 2, 4, 6 veya 8 haftalık brüt ücret. */
export function calculateNotice(input: {
  grossMonthly: number;
  start: string;
  end: string;
  legal: LegalParams;
  stamp: boolean;
}): NoticeResult {
  const service = serviceBreakdown(input.start, input.end);
  const totalMonths = service.totalMonths;
  const weeks = totalMonths < 6 ? 2 : totalMonths < 18 ? 4 : totalMonths < 36 ? 6 : 8;
  const days = weeks * 7;
  const gross = clampMoney((clampMoney(input.grossMonthly) / 30) * days);
  const stampTax = input.stamp ? gross * (input.legal.stampTax / 100) : 0;
  return {
    service,
    weeks,
    days,
    gross: round2(gross),
    stampTax: round2(stampTax),
    net: round2(clampMoney(gross - stampTax)),
  };
}

export interface UnemploymentResult {
  averageGross: number;
  rawBenefit: number;
  cap: number;
  gross: number;
  stampTax: number;
  net: number;
  durationMonths: number;
  eligible: boolean;
}

/** İşsizlik ödeneği: son 4 ayın brüt ortalamasının %40'ı, brüt asgari ücretin %80'i ile sınırlı. */
export function calculateUnemployment(input: {
  wages: [number, number, number, number];
  premiumDays: number;
  legal: LegalParams;
}): UnemploymentResult {
  const averageGross = input.wages.reduce((sum, wage) => sum + clampMoney(wage), 0) / 4;
  const rawBenefit = averageGross * (input.legal.unemploymentRate / 100);
  const cap = input.legal.minWageGross * (input.legal.unemploymentCapRate / 100);
  const gross = clampMoney(Math.min(rawBenefit, cap));
  const stampTax = gross * (input.legal.stampTax / 100);
  const durationMonths =
    input.premiumDays >= 1080 ? 10 : input.premiumDays >= 900 ? 8 : input.premiumDays >= 600 ? 6 : 0;
  return {
    averageGross: round2(averageGross),
    rawBenefit: round2(rawBenefit),
    cap: round2(cap),
    gross: round2(gross),
    stampTax: round2(stampTax),
    net: round2(clampMoney(gross - stampTax)),
    durationMonths,
    eligible: durationMonths > 0,
  };
}

export interface ShortWorkResult {
  averageGross: number;
  rawBenefit: number;
  cap: number;
  gross: number;
  stampTax: number;
  net: number;
  months: number;
  total: number;
}

/** Kısa çalışma ödeneği: son 12 ay ortalamasının %60'ı, brüt asgari ücretin %150'si ile sınırlı. */
export function calculateShortWork(input: {
  averageGross: number;
  months: number;
  legal: LegalParams;
  stamp: boolean;
}): ShortWorkResult {
  const averageGross = clampMoney(input.averageGross);
  const rawBenefit = averageGross * (input.legal.shortWorkRate / 100);
  const cap = input.legal.minWageGross * (input.legal.shortWorkCapRate / 100);
  const gross = clampMoney(Math.min(rawBenefit, cap));
  const stampTax = input.stamp ? gross * (input.legal.stampTax / 100) : 0;
  const net = clampMoney(gross - stampTax);
  const months = Math.max(0, Math.round(input.months));
  return {
    averageGross: round2(averageGross),
    rawBenefit: round2(rawBenefit),
    cap: round2(cap),
    gross: round2(gross),
    stampTax: round2(stampTax),
    net: round2(net),
    months,
    total: round2(net * months),
  };
}
