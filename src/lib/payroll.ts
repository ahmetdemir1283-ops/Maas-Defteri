import type { LegalParams, PayrollOptions, PayrollResult } from '../types.ts';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** Kümülatif dilimli vergi: her oran yalnızca kendi bandına uygulanır. */
export function bracketTax(base: number, legal: LegalParams): number {
  if (base <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const bracket of legal.incomeTaxBrackets) {
    const upper = bracket.limit == null ? Infinity : bracket.limit;
    if (base > lower) {
      tax += (Math.min(base, upper) - lower) * (bracket.rate / 100);
    }
    lower = upper;
    if (base <= upper) break;
  }
  return tax;
}

function employeeRates(legal: LegalParams): number {
  return (legal.sgkEmployee + legal.unemploymentEmployee) / 100;
}

/**
 * Brütten nete. monthIndex 1-12 arasındadır ve kümülatif vergi matrahını belirler.
 * Aylık maaş sabit varsayımıyla yıl içindeki dilim geçişleri hesaplanır.
 */
export function grossToNet(
  gross: number,
  legal: LegalParams,
  options: PayrollOptions = {},
): PayrollResult {
  const monthIndex = Math.min(12, Math.max(1, Math.round(options.monthIndex ?? 1)));
  const cumulative = options.cumulative ?? true;
  const exemption = options.exemption ?? legal.applyMinWageExemption;
  const safeGross = clampMoney(gross);

  const premiumBase = Math.min(safeGross, legal.sgkCeiling > 0 ? legal.sgkCeiling : safeGross);
  const sgk = premiumBase * (legal.sgkEmployee / 100);
  const unemployment = premiumBase * (legal.unemploymentEmployee / 100);
  const taxable = clampMoney(safeGross - sgk - unemployment);

  const periods = cumulative ? monthIndex : 1;
  const previousPeriods = cumulative ? monthIndex - 1 : 0;
  let incomeTax = clampMoney(
    bracketTax(taxable * periods, legal) - bracketTax(taxable * previousPeriods, legal),
  );

  const minWageGross = Math.min(safeGross, legal.minWageGross);
  const minWageTaxable = clampMoney(minWageGross * (1 - employeeRates(legal)));
  const incomeTaxExemption = exemption
    ? clampMoney(
        bracketTax(minWageTaxable * periods, legal) -
          bracketTax(minWageTaxable * previousPeriods, legal),
      )
    : 0;
  incomeTax = clampMoney(incomeTax - incomeTaxExemption);

  const rawStamp = safeGross * (legal.stampTax / 100);
  const stampExemption = exemption ? minWageGross * (legal.stampTax / 100) : 0;
  const stampTax = clampMoney(rawStamp - stampExemption);

  const net = clampMoney(safeGross - sgk - unemployment - incomeTax - stampTax);

  return {
    gross: safeGross,
    sgk,
    unemployment,
    taxable,
    incomeTax,
    incomeTaxExemption,
    stampTax,
    stampExemption,
    net,
    monthIndex,
  };
}

/** Netten brüte: aynı bordro modeliyle ikiye bölerek çözer. */
export function netToGross(
  net: number,
  legal: LegalParams,
  options: PayrollOptions = {},
): PayrollResult {
  const target = clampMoney(net);
  if (target <= 0) return grossToNet(0, legal, options);

  let low = target;
  let high = Math.max(target * 1.4, target + 1000);
  let guard = 0;
  while (grossToNet(high, legal, options).net < target && guard < 40) {
    high *= 1.5;
    guard += 1;
  }
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (grossToNet(mid, legal, options).net < target) low = mid;
    else high = mid;
  }
  return grossToNet((low + high) / 2, legal, options);
}
