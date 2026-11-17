import type {
  Accent,
  AppData,
  LeaveType,
  LegalParams,
  Settings,
  ThemeMode,
} from './types.ts';

export const APP_VERSION = '4.0.1';
export const STORAGE_KEY = 'mesai-defteri:v4';
export const LEGACY_KEY = 'mm2';

export const LEAVE_TYPES: LeaveType[] = [
  'yillik',
  'ucretsiz',
  'saatlik',
  'rapor',
  'mazeret',
  'evlilik',
  'dogum',
  'olum',
  'idari',
  'diger',
];

export const LEAVE_META: Record<
  LeaveType,
  { label: string; short: string; color: string; paid: boolean }
> = {
  yillik: { label: 'Yıllık izin', short: 'Yıllık', color: '#4f7be8', paid: true },
  ucretsiz: { label: 'Ücretsiz izin', short: 'Ücretsiz', color: '#d9534f', paid: false },
  saatlik: { label: 'Saatlik izin', short: 'Saatlik', color: '#12a5b8', paid: true },
  rapor: { label: 'Raporlu gün', short: 'Rapor', color: '#e0952a', paid: true },
  mazeret: { label: 'Mazeret izni', short: 'Mazeret', color: '#7a8094', paid: true },
  evlilik: { label: 'Evlilik izni', short: 'Evlilik', color: '#c75ba8', paid: true },
  dogum: { label: 'Doğum izni', short: 'Doğum', color: '#a86bc4', paid: true },
  olum: { label: 'Ölüm izni', short: 'Ölüm', color: '#5b6470', paid: true },
  idari: { label: 'İdari izin', short: 'İdari', color: '#0ea5e9', paid: true },
  diger: { label: 'Diğer izin', short: 'Diğer', color: '#8b8fa3', paid: true },
};

export const DAY_STATUS_META: Record<string, { label: string; color: string }> = {
  calisma: { label: 'Normal çalışma', color: '#3f8f6b' },
  mesai: { label: 'Fazla mesai', color: '#2f9e6a' },
  tatil: { label: 'Resmi tatil', color: '#d98324' },
  yok: { label: 'Gelmedi', color: '#b4232c' },
  'hafta-tatili': { label: 'Hafta tatili', color: '#9a958a' },
  bos: { label: 'Kayıt yok', color: '#9a958a' },
};

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'cadmium', label: 'Kadmiyum Yeşili', color: '#006B3C' },
  { id: 'ocean', label: 'Gökyüzü', color: '#4f7be8' },
  { id: 'forest', label: 'Orman', color: '#3f9a72' },
  { id: 'violet', label: 'Mor', color: '#8061e0' },
];

export const THEME_MODES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Açık' },
  { id: 'dark', label: 'Koyu' },
  { id: 'auto', label: 'Sistem' },
];

/** 2026 dönemi varsayılanları. Tüm değerler Araçlar bölümünden düzenlenebilir. */
export const DEFAULT_LEGAL: LegalParams = {
  year: 2026,
  verifiedAt: '15.11.2026',
  minWageGross: 33030,
  minWageNet: 28075.5,
  sgkEmployee: 14,
  unemploymentEmployee: 1,
  stampTax: 0.759,
  sgkCeiling: 297270,
  incomeTaxBrackets: [
    { limit: 190000, rate: 15 },
    { limit: 400000, rate: 20 },
    { limit: 1500000, rate: 27 },
    { limit: 5300000, rate: 35 },
    { limit: null, rate: 40 },
  ],
  applyMinWageExemption: true,
  severanceCeilings: [
    { label: '01.07.2026 – 31.12.2026', value: 73729.87 },
    { label: '01.01.2026 – 30.06.2026', value: 64948.77 },
  ],
  severanceCeiling: 73729.87,
  unemploymentRate: 40,
  unemploymentCapRate: 80,
  shortWorkRate: 60,
  shortWorkCapRate: 150,
};

export const DEFAULT_SETTINGS: Settings = {
  salaryMode: 'monthly',
  salaryBasis: 'net',
  monthlySalary: 0,
  hourlyRate: 0,
  dailyHours: 8,
  monthlyHourDivisor: 225,
  weeklyWorkDays: 5,
  workStart: '08:00',
  workEnd: '17:30',
  breakMinutes: 60,
  breakIncluded: false,
  overtimePercent: 50,
  weekendPercent: 50,
  holidayPercent: 100,
  annualLeaveEntitlement: 14,
  annualLeaveCarry: 0,
  deductionName: 'Diğer kesinti',
  deductionAmount: 0,
  deductionPercent: 0,
  leaveDeductions: {
    yillik: false,
    ucretsiz: true,
    saatlik: false,
    rapor: false,
    mazeret: false,
    evlilik: false,
    dogum: false,
    olum: false,
    idari: false,
    diger: false,
  },
};

export function createDefaultData(): AppData {
  const now = new Date().toISOString();
  return {
    version: 4,
    profile: { name: '', workplace: '', position: '', startDate: '' },
    settings: { ...DEFAULT_SETTINGS, leaveDeductions: { ...DEFAULT_SETTINGS.leaveDeductions } },
    salaryHistory: [],
    entries: {},
    leaves: [],
    shifts: [],
    reminders: {
      overtime: { enabled: false, time: '18:00' },
      leave: { enabled: false, time: '09:00' },
      lastFired: {},
    },
    theme: { accent: 'cadmium', mode: 'dark' },
    onboardingDone: false,
    legal: {
      ...DEFAULT_LEGAL,
      incomeTaxBrackets: DEFAULT_LEGAL.incomeTaxBrackets.map((b) => ({ ...b })),
      severanceCeilings: DEFAULT_LEGAL.severanceCeilings.map((c) => ({ ...c })),
    },
    meta: { createdAt: now, updatedAt: now },
  };
}
