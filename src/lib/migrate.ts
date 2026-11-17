import type {
  AppData,
  DayEntry,
  LeaveRecord,
  LeaveType,
  LegalParams,
  ReminderSettings,
  SalaryPeriod,
  Settings,
  Shift,
  TaxBracket,
  ThemeSettings,
} from '../types.ts';
import {
  ACCENTS,
  createDefaultData,
  DEFAULT_SETTINGS,
  LEAVE_TYPES,
  THEME_MODES,
} from '../defaults.ts';
import { diffDays, fromKey, isValidDayKey } from './date.ts';

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function time(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return fallback;
}

function leaveType(value: unknown): LeaveType {
  return LEAVE_TYPES.includes(value as LeaveType) ? (value as LeaveType) : 'diger';
}

export function isLegacyData(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Record<string, unknown>;
  if (raw.version === 4 && raw.settings) return false;
  return raw.e !== undefined || raw.l !== undefined || raw.s !== undefined || raw.p !== undefined;
}

/** Eski (v3 / mm2) verisini yeni modele çevirir. */
export function migrateLegacy(legacyRaw: unknown): Record<string, unknown> {
  const raw = (legacyRaw ?? {}) as Record<string, any>;
  const old = (raw.s ?? {}) as Record<string, any>;
  const settings: Record<string, any> = {
    salaryMode: old.ym === 'saat' ? 'hourly' : 'monthly',
    salaryBasis: 'net',
    monthlySalary: num(old.net),
    hourlyRate: num(old.sa),
    dailyHours: num(old.gun, 8),
    monthlyHourDivisor: num(old.div, 225),
    weeklyWorkDays: num(old.wd, 5) === 6 ? 6 : 5,
    workStart: time(old.bas, '08:00'),
    workEnd: time(old.bit, '17:30'),
    breakMinutes: num(old.mola, 60),
    breakIncluded: bool(old.mp),
    overtimePercent: num(old.otp, 50),
    weekendPercent: num(old.wp, num(old.otp, 50)),
    holidayPercent: num(old.hp, 100),
    annualLeaveEntitlement: num(old.yh, 14),
    annualLeaveCarry: 0,
    deductionName: text(old.dn) || 'Diğer kesinti',
    deductionAmount: num(old.dt),
    deductionPercent: num(old.dy),
    leaveDeductions: { ...DEFAULT_SETTINGS.leaveDeductions },
  };

  // Eski "kaç asgari ücret" yardımı yalnızca net maaş boşsa uygulanır.
  if (!settings.monthlySalary && num(old.cnt) > 0 && num(old.asg) > 0) {
    settings.monthlySalary = Math.round(((num(old.asg) * num(old.cnt)) / 12) * 100) / 100;
  }

  const oldDeductions = (raw.ik ?? {}) as Record<string, unknown>;
  for (const type of LEAVE_TYPES) {
    if (oldDeductions[type] !== undefined) settings.leaveDeductions[type] = bool(oldDeductions[type]);
  }

  const entries: Record<string, DayEntry> = {};
  const oldEntries = (raw.e ?? {}) as Record<string, any>;
  for (const [key, value] of Object.entries(oldEntries)) {
    if (!isValidDayKey(key) || !value || typeof value !== 'object') continue;
    const out: DayEntry = {};
    const source = value as Record<string, any>;
    if (source.t !== undefined) {
      if (source.t === 'ot') out.ot = num(source.m);
      else if (source.t === 'def') out.df = num(source.m);
      else if (source.t === 'abs') out.ab = 1;
      else if (source.t === 'hol') {
        out.rt = 1;
        out.ot = num(source.m);
      }
    }
    if (source.ot !== undefined) out.ot = Math.max(0, num(source.ot));
    if (source.df !== undefined) out.df = Math.max(0, num(source.df));
    if (source.ab) out.ab = 1;
    if (source.rt) out.rt = 1;
    if (source.n) out.n = text(source.n).slice(0, 500);
    if (source.gi) out.gi = time(source.gi, '');
    if (source.ci) out.ci = time(source.ci, '');
    if (Object.keys(out).length) entries[key] = out;
  }

  // Eski günlük izin kayıtlarını bitişik aralıklara grupla.
  const leaves: LeaveRecord[] = [];
  const oldLeaves = (raw.l ?? {}) as Record<string, any>;
  const leaveKeys = Object.keys(oldLeaves)
    .filter(isValidDayKey)
    .sort();
  for (const key of leaveKeys) {
    const source = (oldLeaves[key] ?? {}) as Record<string, any>;
    const type = leaveType(source.k);
    const minutes = Math.max(0, num(source.h));
    const note = text(source.n) || undefined;
    const previous = leaves[leaves.length - 1];
    const adjacent =
      previous &&
      previous.type === type &&
      (previous.minutesPerDay ?? 0) === minutes &&
      (previous.note ?? '') === (note ?? '') &&
      diffDays(fromKey(previous.end), fromKey(key)) === 1;
    if (adjacent && previous) {
      previous.end = key;
    } else {
      leaves.push({
        id: `legacy_${key}_${leaves.length}`,
        type,
        start: key,
        end: key,
        minutesPerDay: minutes || undefined,
        note,
        skipWeekends: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const shifts: Shift[] = Array.isArray(raw.sv)
    ? raw.sv.map((item: Record<string, any>, index: number) => ({
        id: `legacy_shift_${index}`,
        name: text(item?.n) || `Vardiya ${index + 1}`,
        start: time(item?.b, '08:00'),
        end: time(item?.c, '17:00'),
      }))
    : [];

  const oldReminders = (raw.rm ?? {}) as Record<string, any>;

  return {
    version: 4,
    profile: {
      name: text(raw.p?.ad),
      workplace: text(raw.p?.yer),
      position: text(raw.p?.poz),
      startDate: '',
    },
    settings,
    entries,
    leaves,
    shifts,
    salaryHistory: [],
    reminders: {
      overtime: { enabled: bool(oldReminders.a1), time: time(oldReminders.t1, '18:00') },
      leave: { enabled: bool(oldReminders.a2), time: time(oldReminders.t2, '09:00') },
      lastFired: {},
    },
    theme: {
      accent: raw.th === 'sunset' ? 'cadmium' : ACCENTS.some((a) => a.id === raw.th) ? raw.th : 'cadmium',
      mode: THEME_MODES.some((m) => m.id === raw.md) ? raw.md : 'dark',
    },
    onboardingDone: bool(raw.ok),
    legal: { minWageNet: num(old.asg) > 0 ? num(old.asg) : undefined },
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };
}

function normalizeEntry(value: unknown): DayEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, any>;
  const out: DayEntry = {};
  const ot = Math.max(0, Math.round(num(raw.ot)));
  const df = Math.max(0, Math.round(num(raw.df)));
  if (ot) out.ot = ot;
  if (df) out.df = df;
  if (raw.ab) out.ab = 1;
  if (raw.rt) out.rt = 1;
  if (typeof raw.gi === 'string' && /^\d{2}:\d{2}$/.test(raw.gi)) out.gi = raw.gi;
  if (typeof raw.ci === 'string' && /^\d{2}:\d{2}$/.test(raw.ci)) out.ci = raw.ci;
  if (typeof raw.n === 'string' && raw.n.trim()) out.n = raw.n.trim().slice(0, 500);
  if (typeof raw.shiftId === 'string' && raw.shiftId) out.shiftId = raw.shiftId;
  if (typeof raw.upd === 'string') out.upd = raw.upd;
  return Object.keys(out).length ? out : null;
}

function normalizeLeave(value: unknown, index: number): LeaveRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, any>;
  if (!isValidDayKey(raw.start) || !isValidDayKey(raw.end)) return null;
  const start = raw.start <= raw.end ? raw.start : raw.end;
  const end = raw.start <= raw.end ? raw.end : raw.start;
  const type = leaveType(raw.type ?? raw.k);
  const minutes = Math.max(0, Math.round(num(raw.minutesPerDay ?? raw.h)));
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 500) : undefined;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `leave_${start}_${index}`,
    type,
    start,
    end,
    minutesPerDay: minutes || undefined,
    note: note || undefined,
    skipWeekends: bool(raw.skipWeekends, false),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function normalizeShift(value: unknown, index: number): Shift | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, any>;
  const name = text(raw.name ?? raw.n).trim();
  if (!name) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `shift_${index}`,
    name: name.slice(0, 60),
    start: time(raw.start ?? raw.b, '08:00'),
    end: time(raw.end ?? raw.c, '17:00'),
  };
}

function normalizeSalaryPeriod(value: unknown, index: number): SalaryPeriod | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, any>;
  const from = text(raw.from);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from)) return null;
  return {
    id: text(raw.id) || `salary_${from}_${index}`,
    from,
    mode: raw.mode === 'hourly' ? 'hourly' : 'monthly',
    basis: raw.basis === 'gross' ? 'gross' : 'net',
    monthlySalary: Math.max(0, num(raw.monthlySalary)),
    hourlyRate: Math.max(0, num(raw.hourlyRate)),
    monthlyHourDivisor: clamp(num(raw.monthlyHourDivisor, 225), 1, 400),
  };
}

function normalizeBrackets(value: unknown, fallback: TaxBracket[]): TaxBracket[] {
  if (!Array.isArray(value) || value.length < 2) return fallback.map((b) => ({ ...b }));
  const brackets: TaxBracket[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return fallback.map((b) => ({ ...b }));
    const raw = item as Record<string, any>;
    const rate = num(raw.rate, NaN);
    if (!Number.isFinite(rate)) return fallback.map((b) => ({ ...b }));
    const rawLimit = raw.limit;
    const limit =
      rawLimit == null || rawLimit === '' ? null : Math.max(0, num(rawLimit, 0));
    brackets.push({ limit, rate });
  }
  brackets.sort((a, b) => (a.limit ?? Infinity) - (b.limit ?? Infinity));
  return brackets;
}

function normalizeLegal(value: unknown, base: LegalParams): LegalParams {
  const raw = (value ?? {}) as Record<string, any>;
  const brackets = normalizeBrackets(raw.incomeTaxBrackets, base.incomeTaxBrackets);
  if (brackets[brackets.length - 1].limit != null) {
    brackets[brackets.length - 1] = { ...brackets[brackets.length - 1], limit: null };
  }
  const ceilings = Array.isArray(raw.severanceCeilings) && raw.severanceCeilings.length
    ? raw.severanceCeilings
        .filter((item: unknown) => item && typeof item === 'object')
        .map((item: Record<string, any>) => ({
          label: text(item.label) || 'Dönem',
          value: Math.max(0, num(item.value)),
        }))
    : base.severanceCeilings.map((item) => ({ ...item }));
  return {
    ...base,
    ...raw,
    year: Math.round(num(raw.year, base.year)),
    verifiedAt: text(raw.verifiedAt, base.verifiedAt),
    minWageGross: Math.max(0, num(raw.minWageGross, base.minWageGross)),
    minWageNet: Math.max(0, num(raw.minWageNet, base.minWageNet)),
    sgkEmployee: clamp(num(raw.sgkEmployee, base.sgkEmployee), 0, 50),
    unemploymentEmployee: clamp(num(raw.unemploymentEmployee, base.unemploymentEmployee), 0, 10),
    stampTax: clamp(num(raw.stampTax, base.stampTax), 0, 10),
    sgkCeiling: Math.max(0, num(raw.sgkCeiling, base.sgkCeiling)),
    incomeTaxBrackets: brackets,
    applyMinWageExemption: bool(raw.applyMinWageExemption, base.applyMinWageExemption),
    severanceCeilings: ceilings,
    severanceCeiling: Math.max(0, num(raw.severanceCeiling, base.severanceCeiling)),
    unemploymentRate: clamp(num(raw.unemploymentRate, base.unemploymentRate), 0, 100),
    unemploymentCapRate: clamp(num(raw.unemploymentCapRate, base.unemploymentCapRate), 0, 200),
    shortWorkRate: clamp(num(raw.shortWorkRate, base.shortWorkRate), 0, 100),
    shortWorkCapRate: clamp(num(raw.shortWorkCapRate, base.shortWorkCapRate), 0, 300),
  };
}

/** Herhangi bir kaynağı (yeni veri, v3 yedeği, eski mm2) güvenli AppData'ya çevirir. */
export function normalizeData(input: unknown): AppData {
  const base = createDefaultData();
  let raw = (input ?? {}) as Record<string, any>;
  if (raw.data && typeof raw.data === 'object') raw = raw.data as Record<string, any>;
  if (isLegacyData(raw)) raw = migrateLegacy(raw);

  const rawSettings = (raw.settings ?? {}) as Record<string, any>;
  const settings: Settings = {
    ...base.settings,
    salaryMode: rawSettings.salaryMode === 'hourly' ? 'hourly' : 'monthly',
    salaryBasis: rawSettings.salaryBasis === 'gross' ? 'gross' : 'net',
    monthlySalary: Math.max(0, num(rawSettings.monthlySalary, base.settings.monthlySalary)),
    hourlyRate: Math.max(0, num(rawSettings.hourlyRate, base.settings.hourlyRate)),
    dailyHours: clamp(num(rawSettings.dailyHours, base.settings.dailyHours), 0, 24),
    monthlyHourDivisor: clamp(
      num(rawSettings.monthlyHourDivisor, base.settings.monthlyHourDivisor),
      1,
      400,
    ),
    weeklyWorkDays: clamp(Math.round(num(rawSettings.weeklyWorkDays, 5)), 1, 7),
    workStart: time(rawSettings.workStart, base.settings.workStart),
    workEnd: time(rawSettings.workEnd, base.settings.workEnd),
    breakMinutes: clamp(Math.round(num(rawSettings.breakMinutes, 60)), 0, 480),
    breakIncluded: bool(rawSettings.breakIncluded),
    overtimePercent: clamp(num(rawSettings.overtimePercent, 50), 0, 500),
    weekendPercent: clamp(num(rawSettings.weekendPercent, 50), 0, 500),
    holidayPercent: clamp(num(rawSettings.holidayPercent, 100), 0, 500),
    annualLeaveEntitlement: Math.max(0, num(rawSettings.annualLeaveEntitlement, 14)),
    annualLeaveCarry: num(rawSettings.annualLeaveCarry, 0),
    deductionName: text(rawSettings.deductionName) || 'Diğer kesinti',
    deductionAmount: Math.max(0, num(rawSettings.deductionAmount)),
    deductionPercent: clamp(num(rawSettings.deductionPercent), 0, 100),
    leaveDeductions: { ...base.settings.leaveDeductions },
  };
  const rawLeaveDeductions = (rawSettings.leaveDeductions ?? {}) as Record<string, unknown>;
  for (const type of LEAVE_TYPES) {
    if (rawLeaveDeductions[type] !== undefined) {
      settings.leaveDeductions[type] = bool(rawLeaveDeductions[type]);
    }
  }

  const entries: Record<string, DayEntry> = {};
  if (raw.entries && typeof raw.entries === 'object') {
    for (const [key, value] of Object.entries(raw.entries as Record<string, unknown>)) {
      if (!isValidDayKey(key)) continue;
      const entry = normalizeEntry(value);
      if (entry) entries[key] = entry;
    }
  }

  const leaves = Array.isArray(raw.leaves)
    ? raw.leaves
        .map((item, index) => normalizeLeave(item, index))
        .filter((item): item is LeaveRecord => item !== null)
    : [];

  const shifts = Array.isArray(raw.shifts)
    ? raw.shifts
        .map((item, index) => normalizeShift(item, index))
        .filter((item): item is Shift => item !== null)
    : [];

  const salaryHistory = Array.isArray(raw.salaryHistory)
    ? raw.salaryHistory
        .map((item, index) => normalizeSalaryPeriod(item, index))
        .filter((item): item is SalaryPeriod => item !== null)
    : [];

  const rawReminders = (raw.reminders ?? {}) as Record<string, any>;
  const reminders: ReminderSettings = {
    overtime: {
      enabled: bool(rawReminders.overtime?.enabled),
      time: time(rawReminders.overtime?.time, '18:00'),
    },
    leave: {
      enabled: bool(rawReminders.leave?.enabled),
      time: time(rawReminders.leave?.time, '09:00'),
    },
    lastFired:
      rawReminders.lastFired && typeof rawReminders.lastFired === 'object'
        ? Object.fromEntries(
            Object.entries(rawReminders.lastFired as Record<string, unknown>)
              .filter(([, value]) => typeof value === 'string')
              .map(([key, value]) => [key, value as string]),
          )
        : {},
  };

  const rawTheme = (raw.theme ?? {}) as Record<string, any>;
  const theme: ThemeSettings = {
    accent: rawTheme.accent === 'sunset'
      ? 'cadmium'
      : ACCENTS.some((a) => a.id === rawTheme.accent) ? rawTheme.accent : base.theme.accent,
    mode: THEME_MODES.some((m) => m.id === rawTheme.mode) ? rawTheme.mode : base.theme.mode,
  };

  return {
    version: 4,
    profile: {
      name: text(raw.profile?.name).slice(0, 80),
      workplace: text(raw.profile?.workplace).slice(0, 120),
      position: text(raw.profile?.position).slice(0, 120),
      startDate: isValidDayKey(text(raw.profile?.startDate)) ? text(raw.profile?.startDate) : '',
    },
    settings,
    entries,
    leaves,
    shifts,
    salaryHistory,
    reminders,
    theme,
    onboardingDone: bool(raw.onboardingDone),
    legal: normalizeLegal(raw.legal, base.legal),
    meta: {
      createdAt: text(raw.meta?.createdAt, base.meta.createdAt),
      updatedAt: text(raw.meta?.updatedAt, base.meta.updatedAt),
    },
  };
}
