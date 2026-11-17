import type {
  AppData,
  DayEntry,
  DayStatus,
  LeaveRecord,
  LeaveType,
  PayrollResult,
  Settings,
} from '../types.ts';
import { LEAVE_TYPES } from '../defaults.ts';
import {
  daysInMonth,
  fromKey,
  isRestDay,
  monthKey,
  pad2,
  parseHM,
  todayKey,
  dateRange,
} from './date.ts';
import { clampMoney, grossToNet, netToGross, round2 } from './payroll.ts';
import { effectiveSettings } from './salary.ts';

export type OvertimeKind = 'normal' | 'weekend' | 'holiday';

export interface WageInfo {
  base: number;
  hourly: number;
  daily: number;
  divisor: number;
}

export interface LeaveDay {
  record: LeaveRecord;
  type: LeaveType;
  minutesPerDay: number;
}

export interface DayInfo {
  key: string;
  day: number;
  date: Date;
  isRest: boolean;
  isToday: boolean;
  entry: DayEntry | null;
  leave: LeaveDay | null;
  status: DayStatus;
  otMinutes: number;
  otKind: OvertimeKind;
  workedMinutes: number | null;
  shiftId: string | null;
}

export interface MonthSummary {
  year: number;
  month: number;
  base: number;
  hourly: number;
  dailyRate: number;
  otNormalMin: number;
  otWeekendMin: number;
  otHolidayMin: number;
  otTotalMin: number;
  otNormalPay: number;
  otWeekendPay: number;
  otHolidayPay: number;
  otPay: number;
  missingMin: number;
  missingPay: number;
  absentDays: number;
  absentPay: number;
  leaveDays: Record<LeaveType, number>;
  leaveDayCount: number;
  hourlyLeaveDays: number;
  hourlyLeaveMin: number;
  leaveDeduction: number;
  leaveDeductionDays: number;
  otherDeduction: number;
  totalDeduction: number;
  earned: number;
  net: number;
  gross: number;
  payroll: PayrollResult | null;
  estimatedNet: boolean;
  salaryMode: Settings['salaryMode'];
  salaryBasis: Settings['salaryBasis'];
  workedMin: number;
  expectedMin: number;
  workingDays: number;
  recordedDays: number;
  overtimeDays: number;
  weekendWorkedDays: number;
  annualLeaveDays: number;
  unpaidLeaveDays: number;
}

export interface OvertimeRow {
  key: string;
  minutes: number;
  kind: OvertimeKind;
  pay: number;
  note?: string;
  shiftId?: string;
}

export interface LeaveUsageRow {
  record: LeaveRecord;
  days: number;
  minutes: number;
}

export interface YearTotals {
  year: number;
  months: MonthSummary[];
  otTotalMin: number;
  otPay: number;
  totalDeduction: number;
  earned: number;
  net: number;
  gross: number;
  leaveDayCount: number;
  annualLeaveDays: number;
  unpaidLeaveDays: number;
  workedMin: number;
  expectedMin: number;
  workingDays: number;
}

export function wageInfo(settings: Settings): WageInfo {
  const divisor = settings.monthlyHourDivisor > 0 ? settings.monthlyHourDivisor : 225;
  const base = clampMoney(
    settings.salaryMode === 'hourly' ? settings.hourlyRate * divisor : settings.monthlySalary,
  );
  return { base, hourly: base / divisor, daily: base / 30, divisor };
}

export function overtimePay(settings: Settings, minutes: number, kind: OvertimeKind): number {
  if (minutes <= 0) return 0;
  const wage = wageInfo(settings);
  const percent =
    kind === 'holiday'
      ? settings.holidayPercent
      : kind === 'weekend'
        ? settings.weekendPercent
        : settings.overtimePercent;
  return round2(wage.hourly * (1 + percent / 100) * (minutes / 60));
}

export interface EntryDayInfo {
  key: string;
  date: Date;
  isRest: boolean;
  kind: OvertimeKind;
  hourly: number;
  pay: number;
}

/** Tek bir kaydın, ait olduğu ayın maaş dönemiyle hesaplanmış mesai bilgisi. */
export function entryDayInfo(
  data: AppData,
  key: string,
  entry: DayEntry | null = data.entries[key] ?? null,
): EntryDayInfo {
  const date = fromKey(key);
  const settings = effectiveSettings(data, date.getFullYear(), date.getMonth());
  const isRest = isRestDay(date, settings.weeklyWorkDays);
  const kind: OvertimeKind = entry?.rt ? 'holiday' : isRest ? 'weekend' : 'normal';
  const minutes = Math.max(0, Math.round(entry?.ot ?? 0));
  return {
    key,
    date,
    isRest,
    kind,
    hourly: wageInfo(settings).hourly,
    pay: overtimePay(settings, minutes, kind),
  };
}

export function overtimePayForEntry(data: AppData, key: string, entry: DayEntry): number {
  return entryDayInfo(data, key, entry).pay;
}

export function timespanMinutes(start: string | undefined, end: string | undefined): number | null {
  const from = parseHM(start);
  const to = parseHM(end);
  if (from == null || to == null) return null;
  let diff = to - from;
  if (diff < 0) diff += 1440;
  return diff;
}

export function workedMinutes(entry: DayEntry, settings: Settings): number | null {
  const span = timespanMinutes(entry.gi, entry.ci);
  if (span == null) return null;
  const pause = settings.breakIncluded ? 0 : Math.max(0, settings.breakMinutes);
  return Math.max(0, span - pause);
}

/** Kayıt aralığını günlere açar; hafta sonu atlama kayda bağlıdır. */
export function expandLeave(record: LeaveRecord, weeklyWorkDays: number): string[] {
  const keys = dateRange(record.start, record.end);
  if (!record.skipWeekends) return keys;
  return keys.filter((key) => !isRestDay(fromKey(key), weeklyWorkDays));
}

export function leaveDayMap(data: AppData, from: string, to: string): Map<string, LeaveDay> {
  const map = new Map<string, LeaveDay>();
  for (const record of data.leaves) {
    const minutesPerDay = Math.max(0, record.minutesPerDay ?? 0);
    for (const key of expandLeave(record, data.settings.weeklyWorkDays)) {
      if (key < from || key > to) continue;
      map.set(key, { record, type: record.type, minutesPerDay });
    }
  }
  return map;
}

export function leaveOnDate(data: AppData, key: string): LeaveDay | null {
  for (const record of data.leaves) {
    if (key < record.start || key > record.end) continue;
    if (expandLeave(record, data.settings.weeklyWorkDays).includes(key)) {
      return { record, type: record.type, minutesPerDay: Math.max(0, record.minutesPerDay ?? 0) };
    }
  }
  return null;
}

export function buildMonthDays(data: AppData, year: number, month: number): DayInfo[] {
  const settings = data.settings;
  const last = daysInMonth(year, month);
  const prefix = monthKey(year, month);
  const leaveMap = leaveDayMap(data, `${prefix}-01`, `${prefix}-${pad2(last)}`);
  const today = todayKey();
  const days: DayInfo[] = [];

  for (let day = 1; day <= last; day += 1) {
    const key = `${prefix}-${pad2(day)}`;
    const date = new Date(year, month, day);
    const entry = data.entries[key] ?? null;
    const leave = leaveMap.get(key) ?? null;
    const isRest = isRestDay(date, settings.weeklyWorkDays);
    const otMinutes = Math.max(0, Math.round(entry?.ot ?? 0));
    const otKind: OvertimeKind = entry?.rt ? 'holiday' : isRest ? 'weekend' : 'normal';

    let status: DayStatus = 'bos';
    if (leave) status = leave.type;
    else if (entry?.rt) status = 'tatil';
    else if (entry?.ab) status = 'yok';
    else if (otMinutes > 0) status = 'mesai';
    else if (isRest) status = 'hafta-tatili';
    else if (entry && (entry.gi || entry.ci || entry.df || entry.n || entry.shiftId))
      status = 'calisma';

    days.push({
      key,
      day,
      date,
      isRest,
      isToday: key === today,
      entry,
      leave,
      status,
      otMinutes,
      otKind,
      workedMinutes: entry ? workedMinutes(entry, settings) : null,
      shiftId: entry?.shiftId ?? null,
    });
  }
  return days;
}

function emptyLeaveDays(): Record<LeaveType, number> {
  const out = {} as Record<LeaveType, number>;
  for (const type of LEAVE_TYPES) out[type] = 0;
  return out;
}

export function monthSummary(data: AppData, year: number, month: number): MonthSummary {
  const settings = effectiveSettings(data, year, month);
  const wage = wageInfo(settings);
  const days = buildMonthDays(data, year, month);

  let otNormalMin = 0;
  let otWeekendMin = 0;
  let otHolidayMin = 0;
  let missingMin = 0;
  let absentDays = 0;
  let hourlyLeaveDays = 0;
  let hourlyLeaveMin = 0;
  let leaveDayCount = 0;
  let leaveDeduction = 0;
  let leaveDeductionDays = 0;
  let workedMinValue = 0;
  let expectedMin = 0;
  let workingDays = 0;
  let recordedDays = 0;
  let overtimeDays = 0;
  let weekendWorkedDays = 0;
  let annualLeaveDays = 0;
  let unpaidLeaveDays = 0;

  const leaveDays = emptyLeaveDays();

  for (const day of days) {
    if (day.entry) recordedDays += 1;
    if (day.workedMinutes != null) workedMinValue += day.workedMinutes;
    if (day.shiftId) recordedDays += 0;

    if (day.otMinutes > 0) {
      overtimeDays += 1;
      if (day.otKind === 'holiday') otHolidayMin += day.otMinutes;
      else if (day.otKind === 'weekend') otWeekendMin += day.otMinutes;
      else otNormalMin += day.otMinutes;
      if (day.isRest) weekendWorkedDays += 1;
    }

    const fullDayLeave = day.leave && day.leave.type !== 'saatlik';
    if (day.entry?.df && !day.entry.ab) missingMin += Math.max(0, day.entry.df);

    if (fullDayLeave && day.leave) {
      leaveDayCount += 1;
      leaveDays[day.leave.type] += 1;
      if (day.leave.type === 'yillik') annualLeaveDays += 1;
      if (day.leave.type === 'ucretsiz') unpaidLeaveDays += 1;
      if (settings.leaveDeductions[day.leave.type]) {
        leaveDeduction += wage.daily;
        leaveDeductionDays += 1;
      }
    } else if (day.leave?.type === 'saatlik') {
      hourlyLeaveDays += 1;
      hourlyLeaveMin += day.leave.minutesPerDay;
      if (settings.leaveDeductions.saatlik) {
        leaveDeduction += wage.hourly * (day.leave.minutesPerDay / 60);
      }
    }

    if (day.entry?.ab && !fullDayLeave) absentDays += 1;

    if (!day.isRest && !day.entry?.rt && !fullDayLeave) {
      workingDays += 1;
      expectedMin += Math.max(0, settings.dailyHours) * 60;
    }
  }

  const otNormalPay = round2(wage.hourly * (1 + settings.overtimePercent / 100) * (otNormalMin / 60));
  const otWeekendPay = round2(wage.hourly * (1 + settings.weekendPercent / 100) * (otWeekendMin / 60));
  const otHolidayPay = round2(wage.hourly * (1 + settings.holidayPercent / 100) * (otHolidayMin / 60));
  const otPay = round2(otNormalPay + otWeekendPay + otHolidayPay);
  const missingPay = round2(wage.hourly * (missingMin / 60));
  const absentPay = round2(wage.daily * absentDays);
  const otherDeduction = round2(
    Math.max(0, settings.deductionAmount) + wage.base * (Math.max(0, settings.deductionPercent) / 100),
  );
  const totalDeduction = round2(
    missingPay + absentPay + round2(leaveDeduction) + otherDeduction,
  );
  const earned = round2(clampMoney(wage.base + otPay - totalDeduction));

  let net = earned;
  let gross = earned;
  let payroll: PayrollResult | null = null;
  if (wage.base > 0) {
    if (settings.salaryBasis === 'gross') {
      payroll = grossToNet(earned, data.legal, { monthIndex: month + 1 });
      net = round2(payroll.net);
      gross = earned;
    } else {
      payroll = netToGross(earned, data.legal, { monthIndex: month + 1 });
      gross = round2(payroll.gross);
      net = earned;
    }
  }

  return {
    year,
    month,
    base: round2(wage.base),
    hourly: wage.hourly,
    dailyRate: wage.daily,
    otNormalMin,
    otWeekendMin,
    otHolidayMin,
    otTotalMin: otNormalMin + otWeekendMin + otHolidayMin,
    otNormalPay,
    otWeekendPay,
    otHolidayPay,
    otPay,
    missingMin,
    missingPay,
    absentDays,
    absentPay,
    leaveDays,
    leaveDayCount,
    hourlyLeaveDays,
    hourlyLeaveMin,
    leaveDeduction: round2(leaveDeduction),
    leaveDeductionDays,
    otherDeduction,
    totalDeduction,
    earned,
    net,
    gross,
    payroll,
    estimatedNet: settings.salaryBasis === 'gross',
    salaryMode: settings.salaryMode,
    salaryBasis: settings.salaryBasis,
    workedMin: workedMinValue,
    expectedMin,
    workingDays,
    recordedDays,
    overtimeDays,
    weekendWorkedDays,
    annualLeaveDays,
    unpaidLeaveDays,
  };
}

export function yearSummaries(data: AppData, year: number): MonthSummary[] {
  return Array.from({ length: 12 }, (_, month) => monthSummary(data, year, month));
}

export function yearTotals(data: AppData, year: number): YearTotals {
  const months = yearSummaries(data, year);
  const totals = months.reduce(
    (acc, m) => {
      acc.otTotalMin += m.otTotalMin;
      acc.otPay += m.otPay;
      acc.totalDeduction += m.totalDeduction;
      acc.earned += m.earned;
      acc.net += m.net;
      acc.gross += m.gross;
      acc.leaveDayCount += m.leaveDayCount;
      acc.annualLeaveDays += m.annualLeaveDays;
      acc.unpaidLeaveDays += m.unpaidLeaveDays;
      acc.workedMin += m.workedMin;
      acc.expectedMin += m.expectedMin;
      acc.workingDays += m.workingDays;
      return acc;
    },
    {
      otTotalMin: 0,
      otPay: 0,
      totalDeduction: 0,
      earned: 0,
      net: 0,
      gross: 0,
      leaveDayCount: 0,
      annualLeaveDays: 0,
      unpaidLeaveDays: 0,
      workedMin: 0,
      expectedMin: 0,
      workingDays: 0,
    },
  );
  return {
    year,
    months,
    ...totals,
    otPay: round2(totals.otPay),
    totalDeduction: round2(totals.totalDeduction),
    earned: round2(totals.earned),
    net: round2(totals.net),
    gross: round2(totals.gross),
  };
}

export function annualLeaveUsage(data: AppData, year: number): number {
  let used = 0;
  for (const record of data.leaves) {
    if (record.type !== 'yillik') continue;
    for (const key of expandLeave(record, data.settings.weeklyWorkDays)) {
      if (key.startsWith(`${year}-`)) used += 1;
    }
  }
  return used;
}

export function annualLeaveBalance(data: AppData, year: number) {
  const entitlement = data.settings.annualLeaveEntitlement;
  const carry = data.settings.annualLeaveCarry;
  const used = annualLeaveUsage(data, year);
  return { entitlement, carry, used, remaining: entitlement + carry - used };
}

export function leaveUsage(data: AppData, year: number): {
  records: LeaveUsageRow[];
  days: number;
  minutes: number;
} {
  const rows: LeaveUsageRow[] = [];
  let days = 0;
  let minutes = 0;
  for (const record of data.leaves) {
    const keys = expandLeave(record, data.settings.weeklyWorkDays).filter((key) =>
      key.startsWith(`${year}-`),
    );
    if (!keys.length) continue;
    const rowMinutes =
      record.type === 'saatlik' ? keys.length * Math.max(0, record.minutesPerDay ?? 0) : 0;
    rows.push({ record, days: keys.length, minutes: rowMinutes });
    days += keys.length;
    minutes += rowMinutes;
  }
  rows.sort((a, b) => a.record.start.localeCompare(b.record.start));
  return { records: rows, days, minutes };
}

export function overtimeRows(
  data: AppData,
  year: number,
  month: number | null = null,
): OvertimeRow[] {
  const prefix = month == null ? `${year}-` : `${monthKey(year, month)}-`;
  const rows: OvertimeRow[] = [];
  for (const [key, entry] of Object.entries(data.entries)) {
    if (!key.startsWith(prefix)) continue;
    const ot = Math.max(0, Math.round(entry.ot ?? 0));
    if (!ot) continue;
    const date = fromKey(key);
    const settings = effectiveSettings(data, date.getFullYear(), date.getMonth());
    const kind: OvertimeKind = entry.rt
      ? 'holiday'
      : isRestDay(date, settings.weeklyWorkDays)
        ? 'weekend'
        : 'normal';
    rows.push({
      key,
      minutes: ot,
      kind,
      pay: overtimePay(settings, ot, kind),
      note: entry.n,
      shiftId: entry.shiftId,
    });
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows;
}
