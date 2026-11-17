import { strict as assert } from 'node:assert';
import { createDefaultData, DEFAULT_LEGAL } from '../src/defaults.ts';
import { bracketTax, grossToNet, netToGross } from '../src/lib/payroll.ts';
import {
  calculateNotice,
  calculateSeverance,
  calculateShortWork,
  calculateUnemployment,
} from '../src/lib/legal.ts';
import {
  annualLeaveBalance,
  buildMonthDays,
  leaveUsage,
  monthSummary,
  overtimePayForEntry,
  overtimeRows,
  yearTotals,
} from '../src/lib/calc.ts';
import { migrateLegacy, normalizeData } from '../src/lib/migrate.ts';
import { ensureSalaryHistory, salaryForMonth } from '../src/lib/salary.ts';
import { serviceBreakdown } from '../src/lib/date.ts';

let checks = 0;
function close(actual: number, expected: number, tolerance = 0.01, label = '') {
  checks += 1;
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label || 'değer'}: beklenen ${expected}, bulunan ${actual}`,
  );
}
function equal(actual: unknown, expected: unknown, label = '') {
  checks += 1;
  assert.equal(actual, expected, label);
}

// ---- Bordro: 2026 asgari ücret ----
const minWage = grossToNet(33030, DEFAULT_LEGAL, { monthIndex: 1 });
close(minWage.net, 28075.5, 0.01, 'asgari ücret neti');
close(minWage.incomeTax, 0, 0.01, 'asgari ücret gelir vergisi');
close(minWage.stampTax, 0, 0.01, 'asgari ücret damga vergisi');

const minWageDecember = grossToNet(33030, DEFAULT_LEGAL, { monthIndex: 12 });
close(minWageDecember.net, 28075.5, 0.01, 'asgari ücret aralık neti');

// ---- Bordro: yüksek ücret, kümülatif dilim ----
const high = grossToNet(100000, DEFAULT_LEGAL, { monthIndex: 1 });
close(high.sgk, 14000, 0.01, 'SGK işçi payı');
close(high.unemployment, 1000, 0.01, 'işsizlik işçi payı');
close(high.taxable, 85000, 0.01, 'vergi matrahı');
close(high.incomeTax, 8538.67, 0.02, 'gelir vergisi');
close(high.stampTax, 508.3, 0.02, 'damga vergisi');
close(high.net, 75953.02, 0.02, '100.000 brüt neti');

const solvedGross = netToGross(28075.5, DEFAULT_LEGAL, { monthIndex: 1 });
close(solvedGross.gross, 33030, 0.5, 'netten brüte çözümü');
const solvedHigh = netToGross(75953.02, DEFAULT_LEGAL, { monthIndex: 1 });
close(solvedHigh.gross, 100000, 0.5, 'yüksek netten brüte çözümü');

close(bracketTax(190000, DEFAULT_LEGAL), 28500, 0.01, 'ilk dilim vergisi');
close(bracketTax(400000, DEFAULT_LEGAL), 70500, 0.01, 'ikinci dilim vergisi');

// ---- Kıdem / ihbar ----
const severance = calculateSeverance({
  grossMonthly: 100000,
  start: '2026-01-01',
  end: '2027-01-01',
  legal: DEFAULT_LEGAL,
  ceiling: DEFAULT_LEGAL.severanceCeiling,
  stamp: true,
});
close(severance.service.years, 1, 0, 'kıdem hizmet yılı');
close(severance.gross, 73729.87, 0.01, 'kıdem tavanlı brüt');
close(severance.stampTax, 559.61, 0.02, 'kıdem damga vergisi');
close(severance.net, 73170.26, 0.03, 'kıdem neti');

const notice = calculateNotice({
  grossMonthly: 100000,
  start: '2022-01-01',
  end: '2026-11-15',
  legal: DEFAULT_LEGAL,
  stamp: true,
});
equal(notice.weeks, 8, 'ihbar haftası');
close(notice.gross, 186666.67, 0.02, 'ihbar brütü');

const shortService = calculateNotice({
  grossMonthly: 30000,
  start: '2026-01-01',
  end: '2026-03-01',
  legal: DEFAULT_LEGAL,
  stamp: false,
});
equal(shortService.weeks, 2, 'kısa hizmette ihbar haftası');

// ---- İşsizlik / kısa çalışma ----
const unemployment = calculateUnemployment({
  wages: [55000, 55000, 55000, 55000],
  premiumDays: 950,
  legal: DEFAULT_LEGAL,
});
close(unemployment.gross, 22000, 0.01, 'işsizlik brüt');
close(unemployment.net, 21833.02, 0.02, 'işsizlik neti');
equal(unemployment.durationMonths, 8, 'işsizlik süresi');

const cappedUnemployment = calculateUnemployment({
  wages: [80000, 80000, 80000, 80000],
  premiumDays: 1100,
  legal: DEFAULT_LEGAL,
});
close(cappedUnemployment.gross, 26424, 0.01, 'işsizlik tavanı');
equal(cappedUnemployment.durationMonths, 10, 'işsizlik üst süresi');

const shortWork = calculateShortWork({
  averageGross: 40000,
  months: 3,
  legal: DEFAULT_LEGAL,
  stamp: true,
});
close(shortWork.gross, 24000, 0.01, 'kısa çalışma brüt');
close(shortWork.net, 23817.84, 0.02, 'kısa çalışma neti');
close(shortWork.total, 71453.52, 0.05, 'kısa çalışma toplamı');

close(serviceBreakdown('2022-01-01', '2026-11-15').years, 4, 0, 'hizmet yılı');

// ---- Aylık özet ----
const data = createDefaultData();
data.settings.monthlySalary = 30000;
data.settings.salaryMode = 'monthly';
data.settings.salaryBasis = 'net';
data.settings.dailyHours = 8;
data.settings.monthlyHourDivisor = 225;
data.settings.weeklyWorkDays = 5;
data.settings.breakMinutes = 60;
data.settings.breakIncluded = false;
data.settings.annualLeaveEntitlement = 14;
data.entries['2026-11-02'] = { ot: 120, gi: '08:00', ci: '19:00' };
data.entries['2026-11-07'] = { ot: 60 };
data.entries['2026-11-10'] = { df: 60 };
data.entries['2026-11-11'] = { ab: 1 };
data.leaves.push({
  id: 'l1',
  type: 'yillik',
  start: '2026-11-16',
  end: '2026-11-17',
  skipWeekends: true,
  createdAt: '',
});
data.leaves.push({
  id: 'l2',
  type: 'ucretsiz',
  start: '2026-11-18',
  end: '2026-11-18',
  skipWeekends: true,
  createdAt: '',
});

const summary = monthSummary(data, 2026, 10);
close(summary.base, 30000, 0.01, 'aylık taban');
close(summary.hourly, 133.3333, 0.001, 'saatlik ücret');
close(summary.dailyRate, 1000, 0.01, 'günlük ücret');
equal(summary.otNormalMin, 120, 'normal mesai dakikası');
equal(summary.otWeekendMin, 60, 'hafta sonu mesai dakikası');
close(summary.otNormalPay, 400, 0.01, 'normal mesai ücreti');
close(summary.otWeekendPay, 200, 0.01, 'hafta sonu mesai ücreti');
equal(summary.missingMin, 60, 'eksik dakika');
close(summary.missingPay, 133.33, 0.01, 'eksik saat kesintisi');
equal(summary.absentDays, 1, 'gelmedi günü');
close(summary.absentPay, 1000, 0.01, 'gelmedi kesintisi');
equal(summary.leaveDays.yillik, 2, 'yıllık izin günü');
equal(summary.unpaidLeaveDays, 1, 'ücretsiz izin günü');
close(summary.leaveDeduction, 1000, 0.01, 'ücretsiz izin kesintisi');
close(summary.totalDeduction, 2133.33, 0.02, 'toplam kesinti');
close(summary.earned, 28466.67, 0.02, 'toplam alacak');
close(summary.workedMin, 600, 0, 'çalışılan dakika');
equal(summary.overtimeDays, 2, 'mesai günü');
equal(summary.weekendWorkedDays, 1, 'hafta sonu çalışması');

const days = buildMonthDays(data, 2026, 10);
equal(days.length, 30, 'kasım gün sayısı');
equal(days.find((d) => d.key === '2026-11-07')?.status, 'mesai', 'cumartesi mesai durumu');
equal(days.find((d) => d.key === '2026-11-07')?.isRest, true, 'cumartesi tatil');
equal(days.find((d) => d.key === '2026-11-15')?.isRest, true, 'pazar tatil');
equal(days.find((d) => d.key === '2026-11-16')?.status, 'yillik', 'yıllık izin durumu');
equal(days.find((d) => d.key === '2026-11-18')?.status, 'ucretsiz', 'ücretsiz izin durumu');

const balance = annualLeaveBalance(data, 2026);
equal(balance.used, 2, 'kullanılan yıllık izin');
equal(balance.remaining, 12, 'kalan yıllık izin');

const usage = leaveUsage(data, 2026);
equal(usage.days, 3, 'toplam izin günü');
const rows = overtimeRows(data, 2026, 10);
equal(rows.length, 2, 'mesai kayıt sayısı');
close(
  rows.reduce((sum, row) => sum + row.pay, 0),
  600,
  0.01,
  'mesai listesi toplamı',
);

const totals = yearTotals(data, 2026);
equal(totals.months.length, 12, 'yıl ayları');
close(totals.otPay, 600, 0.01, 'yıllık mesai geliri');

// Haftalık 6 gün çalışma: cumartesi tatil değil.
data.settings.weeklyWorkDays = 6;
equal(buildMonthDays(data, 2026, 10).find((d) => d.key === '2026-11-07')?.isRest, false, '6 gün çalışma');

// Mola çalışma sayılırsa 11 saat çalışılmış olur.
data.settings.weeklyWorkDays = 5;
data.settings.breakIncluded = true;
equal(buildMonthDays(data, 2026, 10).find((d) => d.key === '2026-11-02')?.workedMinutes, 660, 'mola dahil süre');

// Saatlik izin kesintisi
const hourly = createDefaultData();
hourly.settings.monthlySalary = 22500;
hourly.settings.monthlyHourDivisor = 225;
hourly.leaves.push({
  id: 'h1',
  type: 'saatlik',
  start: '2026-11-03',
  end: '2026-11-03',
  minutesPerDay: 120,
  skipWeekends: true,
  createdAt: '',
});
hourly.settings.leaveDeductions.saatlik = true;
const hourlySummary = monthSummary(hourly, 2026, 10);
close(hourlySummary.hourlyLeaveMin, 120, 0, 'saatlik izin dakikası');
close(hourlySummary.leaveDeduction, 200, 0.01, 'saatlik izin kesintisi');

// ---- Brüt maaş yönü ----
const grossData = createDefaultData();
grossData.settings.salaryBasis = 'gross';
grossData.settings.monthlySalary = 33030;
const grossSummary = monthSummary(grossData, 2026, 10);
close(grossSummary.net, 28075.5, 0.01, 'brüt maaş tahmini neti');
equal(grossSummary.estimatedNet, true, 'brüt maaş işareti');

// ---- Ay bazlı maaş geçmişi ----
const historyData = createDefaultData();
historyData.settings.monthlySalary = 30000;
historyData.entries['2026-09-10'] = { ot: 60 };
historyData.entries['2026-11-10'] = { ot: 60 };
historyData.salaryHistory = [
  {
    id: 'p1',
    from: '2026-09',
    mode: 'monthly',
    basis: 'net',
    monthlySalary: 22500,
    hourlyRate: 0,
    monthlyHourDivisor: 225,
  },
  {
    id: 'p2',
    from: '2026-11',
    mode: 'monthly',
    basis: 'net',
    monthlySalary: 45000,
    hourlyRate: 0,
    monthlyHourDivisor: 225,
  },
];
const september = monthSummary(historyData, 2026, 8);
const october = monthSummary(historyData, 2026, 9);
const november = monthSummary(historyData, 2026, 10);
close(september.base, 22500, 0.01, 'eylül dönem maaşı');
close(october.base, 22500, 0.01, 'dönem devamlılığı');
close(november.base, 45000, 0.01, 'kasım dönem maaşı');
close(september.otPay, 150, 0.01, 'eylül mesai ücreti');
close(november.otPay, 300, 0.01, 'kasım mesai ücreti');
equal(september.salaryBasis, 'net', 'ayın maaş türü');
close(overtimeRows(historyData, 2026, 8)[0].pay, 150, 0.01, 'mesai listesi eski ay ücreti');
close(overtimePayForEntry(historyData, '2026-11-10', { ot: 60 }), 300, 0.01, 'son kayıt ay ücreti');
equal(salaryForMonth(historyData, 2026, 9).id, 'p1', 'ayın dönemi');

const normalizedHistory = normalizeData(historyData);
equal(normalizedHistory.salaryHistory.length, 2, 'maaş dönemi normalizasyonu');
const filteredHistory = normalizeData({
  settings: {},
  salaryHistory: [{ from: '2026-13' }, { from: '2026-05', monthlySalary: 1000 }],
});
equal(filteredHistory.salaryHistory.length, 1, 'geçersiz dönem ayıklanır');

const autoHistory = ensureSalaryHistory({
  ...createDefaultData(),
  entries: { '2025-03-04': { ot: 60 } },
});
equal(autoHistory.salaryHistory.length, 1, 'otomatik dönem');
equal(autoHistory.salaryHistory[0].from, '2025-03', 'otomatik dönem başlangıcı');

// ---- Eski veri taşıma ----
const legacy = {
  p: { ad: 'Ali', yer: 'Firma', poz: 'Tekniker' },
  s: {
    net: '30000',
    gun: 9,
    div: 225,
    wd: 5,
    otp: 50,
    hp: 100,
    bas: '08:00',
    bit: '17:00',
    mola: 60,
    mp: 0,
    ym: 'maas',
    asg: 28075.5,
    cnt: 0,
    yh: 20,
  },
  e: { '2026-11-02': { ot: 60, gi: '08:00', ci: '18:00' } },
  l: {
    '2026-11-16': { k: 'yillik', n: 'Tatil' },
    '2026-11-17': { k: 'yillik', n: 'Tatil' },
  },
  sv: [{ n: 'Gündüz', b: '08:00', c: '17:00' }],
  ik: { ucretsiz: 1, yillik: 0 },
  rm: { a1: 1, t1: '18:30', a2: 0, t2: '09:00' },
  th: 'ocean',
  md: 'light',
  ok: 1,
};
const migrated = normalizeData(migrateLegacy(legacy));
equal(migrated.settings.monthlySalary, 30000, 'eski maaş aktarımı');
equal(migrated.settings.dailyHours, 9, 'eski günlük saat');
equal(migrated.settings.annualLeaveEntitlement, 20, 'eski izin hakkı');
equal(migrated.leaves.length, 1, 'bitişik izinler birleşti');
equal(migrated.leaves[0].end, '2026-11-17', 'izin bitişi');
equal(migrated.entries['2026-11-02'].ot, 60, 'eski mesai');
equal(migrated.shifts.length, 1, 'eski vardiya');
equal(migrated.theme.accent, 'ocean', 'eski tema');
equal(migrated.reminders.overtime.time, '18:30', 'eski hatırlatıcı');
equal(migrated.onboardingDone, true, 'kurulum tamam');
equal(migrated.settings.leaveDeductions.ucretsiz, true, 'eski kesinti bayrağı');
equal(migrated.settings.leaveDeductions.yillik, false, 'eski ücretli izin bayrağı');
close(annualLeaveBalance(migrated, 2026).used, 2, 0, 'taşınan izin kullanımı');

const wrapped = normalizeData({ app: 'mesai-defteri', v: 3, data: legacy });
equal(wrapped.profile.name, 'Ali', 'v3 yedeği profili');

const empty = normalizeData(null);
equal(empty.settings.monthlyHourDivisor, 225, 'boş veri varsayılanı');
equal(empty.leaves.length, 0, 'boş veri izinleri');
equal(empty.legal.incomeTaxBrackets.length, 5, 'varsayılan vergi dilimi');

console.log(`Tüm hesaplama kontrolleri geçti (${checks} kontrol).`);
