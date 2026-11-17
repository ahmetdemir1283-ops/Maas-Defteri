export type Accent = 'cadmium' | 'ocean' | 'forest' | 'violet';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type SalaryMode = 'monthly' | 'hourly';
export type SalaryBasis = 'net' | 'gross';

export type LeaveType =
  | 'yillik'
  | 'ucretsiz'
  | 'saatlik'
  | 'rapor'
  | 'mazeret'
  | 'evlilik'
  | 'dogum'
  | 'olum'
  | 'idari'
  | 'diger';

export type DayStatus =
  | 'bos'
  | 'calisma'
  | 'mesai'
  | 'tatil'
  | 'yok'
  | 'hafta-tatili'
  | LeaveType;

export interface Profile {
  name: string;
  workplace: string;
  position: string;
  startDate: string;
}

export interface SalaryPeriod {
  id: string;
  from: string;
  mode: SalaryMode;
  basis: SalaryBasis;
  monthlySalary: number;
  hourlyRate: number;
  monthlyHourDivisor: number;
}

export interface Settings {
  salaryMode: SalaryMode;
  salaryBasis: SalaryBasis;
  monthlySalary: number;
  hourlyRate: number;
  dailyHours: number;
  monthlyHourDivisor: number;
  weeklyWorkDays: number;
  workStart: string;
  workEnd: string;
  breakMinutes: number;
  breakIncluded: boolean;
  overtimePercent: number;
  weekendPercent: number;
  holidayPercent: number;
  annualLeaveEntitlement: number;
  annualLeaveCarry: number;
  deductionName: string;
  deductionAmount: number;
  deductionPercent: number;
  leaveDeductions: Record<LeaveType, boolean>;
}

export interface DayEntry {
  ot?: number;
  df?: number;
  ab?: 1;
  rt?: 1;
  n?: string;
  gi?: string;
  ci?: string;
  shiftId?: string;
  upd?: string;
}

export interface LeaveRecord {
  id: string;
  type: LeaveType;
  start: string;
  end: string;
  minutesPerDay?: number;
  note?: string;
  skipWeekends: boolean;
  createdAt: string;
}

export interface Shift {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface ReminderSettings {
  overtime: { enabled: boolean; time: string };
  leave: { enabled: boolean; time: string };
  lastFired: Record<string, string>;
}

export interface ThemeSettings {
  accent: Accent;
  mode: ThemeMode;
}

export interface TaxBracket {
  limit: number | null;
  rate: number;
}

export interface SeveranceCeiling {
  label: string;
  value: number;
}

export interface LegalParams {
  year: number;
  verifiedAt: string;
  minWageGross: number;
  minWageNet: number;
  sgkEmployee: number;
  unemploymentEmployee: number;
  stampTax: number;
  sgkCeiling: number;
  incomeTaxBrackets: TaxBracket[];
  applyMinWageExemption: boolean;
  severanceCeilings: SeveranceCeiling[];
  severanceCeiling: number;
  unemploymentRate: number;
  unemploymentCapRate: number;
  shortWorkRate: number;
  shortWorkCapRate: number;
}

export interface AppData {
  version: number;
  profile: Profile;
  settings: Settings;
  salaryHistory: SalaryPeriod[];
  entries: Record<string, DayEntry>;
  leaves: LeaveRecord[];
  shifts: Shift[];
  reminders: ReminderSettings;
  theme: ThemeSettings;
  onboardingDone: boolean;
  legal: LegalParams;
  meta: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface PayrollOptions {
  monthIndex?: number;
  cumulative?: boolean;
  exemption?: boolean;
}

export interface PayrollResult {
  gross: number;
  sgk: number;
  unemployment: number;
  taxable: number;
  incomeTax: number;
  incomeTaxExemption: number;
  stampTax: number;
  stampExemption: number;
  net: number;
  monthIndex: number;
}
