import { useState } from 'react';
import { useApp } from '../store';
import {
  annualLeaveBalance,
  buildMonthDays,
  leaveUsage,
  monthSummary,
  overtimeRows,
  yearSummaries,
  yearTotals,
} from '../lib/calc';
import { LEAVE_META, LEAVE_TYPES } from '../defaults';
import { duration, money, shortDuration } from '../lib/format';
import { MONTHS, MONTHS_SHORT, pad2, shortDateLabel } from '../lib/date';
import {
  Button,
  Card,
  Empty,
  MonthNav,
  PageTop,
  Row,
  SelectField,
  Stat,
  YearNav,
} from '../components/ui';
import { DetailedSummary } from '../components/SummaryRows';
import type { AppData } from '../types';
import type { MonthSummary } from '../lib/calc';

type ReportTab = 'month' | 'daily' | 'year' | 'overtime' | 'leave' | 'salary';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'month', label: 'Aylık' },
  { id: 'daily', label: 'Günlük' },
  { id: 'year', label: 'Yıllık' },
  { id: 'overtime', label: 'Mesai listesi' },
  { id: 'leave', label: 'İzin' },
  { id: 'salary', label: 'Maaş' },
];

export default function ReportsScreen() {
  const { data, ui, stepMonth, setView, navigate, notify, openLeaveFor } = useApp();
  const [tab, setTab] = useState<ReportTab>('month');
  const [otMonth, setOtMonth] = useState<string>(String(ui.view.month));

  const { year, month } = ui.view;
  const summary = monthSummary(data, year, month);

  const printReport = () => {
    const previous = document.title;
    document.title = `Mesai-Raporu-${year}-${pad2(month + 1)}`;
    window.print();
    document.title = previous;
  };

  const shareReport = async () => {
    const text = buildShareText(data, tab, year, month, otMonth);
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>;
    };
    try {
      if (nav.share) {
        await nav.share({ title: 'Mesai raporu', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      notify('Rapor panoya kopyalandı.');
    } catch {
      notify('Paylaşım tamamlanmadı. Raporu PDF olarak kaydedebilirsin.');
    }
  };

  return (
    <>
      <PageTop title="Raporlar" onBack={() => navigate('home')} />
      <div className="btn-row report-actions no-print" style={{ marginBottom: 10 }}>
        <Button small variant="ghost" onClick={printReport}>
          PDF / Yazdır
        </Button>
        <Button small variant="ghost" onClick={shareReport}>
          Paylaş
        </Button>
      </div>

      <div className="pill-row no-print">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`pill ${tab === item.id ? 'on' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(tab === 'month' || tab === 'daily' || tab === 'salary') && (
        <MonthNav
          year={year}
          month={month}
          onPrev={() => stepMonth(-1)}
          onNext={() => stepMonth(1)}
          onToday={() => {
            const now = new Date();
            setView(now.getFullYear(), now.getMonth());
          }}
        />
      )}
      {(tab === 'year' || tab === 'overtime' || tab === 'leave') && (
        <YearNav
          year={year}
          onPrev={() => setView(year - 1, month)}
          onNext={() => setView(year + 1, month)}
        />
      )}

      {tab === 'month' && <MonthlyReport data={data} summary={summary} />}
      {tab === 'daily' && <DailyReport data={data} year={year} month={month} />}
      {tab === 'year' && <YearlyReport data={data} year={year} />}
      {tab === 'overtime' && (
        <OvertimeReport
          data={data}
          year={year}
          month={otMonth}
          setMonth={setOtMonth}
        />
      )}
      {tab === 'leave' && <LeaveReport data={data} year={year} onAdd={() => openLeaveFor(`${year}-${pad2(month + 1)}-01`)} />}
      {tab === 'salary' && <SalaryReport data={data} summary={summary} year={year} />}
    </>
  );
}

function MonthlyReport({ data, summary }: { data: AppData; summary: MonthSummary }) {
  return (
    <>
      <Card title={`${MONTHS[summary.month]} ${summary.year} özeti`}>
        <div className="stat-grid">
          <Stat label="Toplam çalışma" value={duration(summary.workedMin)} />
          <Stat label="Fazla mesai" value={duration(summary.otTotalMin)} />
          <Stat label="İzin günü" value={`${summary.leaveDayCount} gün`} />
          <Stat
            label={summary.estimatedNet ? 'Tahmini net' : 'Toplam alacak'}
            value={money(summary.net)}
            accent
          />
        </div>
        <div className="rows" style={{ marginTop: 10 }}>
          <Row label="Normal çalışma günü" value={`${summary.workingDays} gün`} />
          <Row label="Mesai yapılan gün" value={`${summary.overtimeDays} gün`} />
          <Row label="Hafta sonu çalışması" value={`${summary.weekendWorkedDays} gün`} />
          <Row label="Eksik saat" value={duration(summary.missingMin)} />
          <Row label="Beklenen normal süre" value={duration(summary.expectedMin)} />
        </div>
      </Card>

      <Card title="Kazanç ve kesinti dökümü">
        <DetailedSummary summary={summary} settings={data.settings} />
      </Card>

      {summary.leaveDayCount + summary.hourlyLeaveDays > 0 && (
        <Card title="İzin dökümü">
          {LEAVE_TYPES.filter(
            (type) => summary.leaveDays[type] > 0 || (type === 'saatlik' && summary.hourlyLeaveMin > 0),
          ).map((type) => (
            <Row
              key={type}
              label={LEAVE_META[type].label}
              value={
                type === 'saatlik'
                  ? duration(summary.hourlyLeaveMin)
                  : `${summary.leaveDays[type]} gün`
              }
            />
          ))}
        </Card>
      )}
    </>
  );
}

function DailyReport({
  data,
  year,
  month,
}: {
  data: AppData;
  year: number;
  month: number;
}) {
  const days = buildMonthDays(data, year, month);
  const records = days.filter((day) => day.entry || day.leave);
  return (
    <Card title="Günlük çalışma raporu">
      {records.length ? (
        records.map((day) => (
          <div key={day.key} className="entry-row">
            <div className="entry-main">
              <div className="entry-title">
                <b>{shortDateLabel(day.key)}</b>
                {day.leave ? (
                  <span className="badge">
                    <i style={{ background: LEAVE_META[day.leave.type].color }} />
                    {LEAVE_META[day.leave.type].label}
                  </span>
                ) : day.entry?.ab ? (
                  <span className="badge">
                    <i style={{ background: '#b4232c' }} />
                    Gelmedi
                  </span>
                ) : day.entry?.rt ? (
                  <span className="badge">
                    <i style={{ background: '#d98324' }} />
                    Resmi tatil
                  </span>
                ) : day.isRest ? (
                  <span className="badge">Hafta tatili</span>
                ) : (
                  <span className="badge">Normal çalışma</span>
                )}
              </div>
              <div className="entry-meta">
                {day.entry?.gi && day.entry?.ci
                  ? `${day.entry.gi}–${day.entry.ci}`
                  : 'Saat kaydı yok'}
                {day.workedMinutes != null ? ` · ${duration(day.workedMinutes)}` : ''}
                {day.entry?.n ? ` · ${day.entry.n}` : ''}
                {day.leave?.record.note ? ` · ${day.leave.record.note}` : ''}
              </div>
            </div>
            <div className="entry-val">
              {day.otMinutes > 0 && <span className="pos">+{duration(day.otMinutes)}</span>}
              {day.entry?.df ? (
                <span className="neg" style={{ display: 'block' }}>
                  −{duration(day.entry.df)}
                </span>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <Empty title="Kayıt yok" sub="Bu ay için mesai veya izin girilmemiş." />
      )}
    </Card>
  );
}

function YearlyReport({ data, year }: { data: AppData; year: number }) {
  const totals = yearTotals(data, year);
  const max = Math.max(1, ...totals.months.map((item) => item.otTotalMin));
  return (
    <>
      <Card title={`${year} fazla mesai grafiği`}>
        <div className="bars">
          {totals.months.map((item) => (
            <div className="bar-col" key={item.month}>
              <div
                className="bar"
                style={{ height: `${Math.max(item.otTotalMin > 0 ? 3 : 0, (item.otTotalMin / max) * 100)}%` }}
                title={`${MONTHS[item.month]}: ${duration(item.otTotalMin)}`}
              />
            </div>
          ))}
        </div>
        <div className="bar-labels">
          {MONTHS_SHORT.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </Card>

      <Card title={`${year} yıllık toplamlar`}>
        <div className="stat-grid">
          <Stat label="Fazla mesai" value={duration(totals.otTotalMin)} />
          <Stat label="Mesai geliri" value={money(totals.otPay)} />
          <Stat label="Çalışılan" value={duration(totals.workedMin)} />
          <Stat label="İzin günü" value={`${totals.leaveDayCount} gün`} />
        </div>
        <div className="rows" style={{ marginTop: 10 }}>
          <Row label="Toplam kesinti" value={money(totals.totalDeduction)} tone="neg" />
          <Row label="Tahmini net toplam" value={money(totals.net)} total />
          <Row label="Yaklaşık brüt toplam" value={money(totals.gross)} />
        </div>
      </Card>

      <Card title="Aylık döküm">
        {totals.months.map((item) => (
          <Row
            key={item.month}
            label={MONTHS[item.month]}
            value={`${duration(item.otTotalMin)} · ${money(item.net)}`}
            sub={item.leaveDayCount ? `${item.leaveDayCount} izin günü` : undefined}
          />
        ))}
      </Card>
    </>
  );
}

function OvertimeReport({
  data,
  year,
  month,
  setMonth,
}: {
  data: AppData;
  year: number;
  month: string;
  setMonth: (value: string) => void;
}) {
  const rows = overtimeRows(data, year, month === 'all' ? null : Number(month));
  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const totalPay = rows.reduce((sum, row) => sum + row.pay, 0);
  return (
    <>
      <SelectField
        label="Dönem"
        value={month}
        onChange={setMonth}
        options={[
          { value: 'all', label: `${year} tüm yıl` },
          ...MONTHS.map((label, index) => ({
            value: String(index),
            label: `${label} ${year}`,
          })),
        ]}
      />
      <Card title="Fazla mesai listesi">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.key} className="entry-row">
              <div className="entry-main">
                <div className="entry-title">
                  <b>{shortDateLabel(row.key)}</b>
                  <span className="badge">
                    <i
                      style={{
                        background:
                          row.kind === 'holiday'
                            ? '#d98324'
                            : row.kind === 'weekend'
                              ? '#2f9e6a'
                              : '#4f7be8',
                      }}
                    />
                    {row.kind === 'holiday'
                      ? 'Resmi tatil'
                      : row.kind === 'weekend'
                        ? 'Hafta sonu'
                        : 'Normal'}
                  </span>
                </div>
                <div className="entry-meta">
                  {row.note ? row.note : 'Not yok'}
                  {row.shiftId
                    ? ` · ${data.shifts.find((shift) => shift.id === row.shiftId)?.name ?? 'Vardiya'}`
                    : ''}
                </div>
              </div>
              <div className="entry-val">
                <span className="pos">{duration(row.minutes)}</span>
                <span className="muted" style={{ display: 'block' }}>
                  {money(row.pay)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <Empty title="Mesai kaydı yok" sub="Seçilen dönemde fazla mesai girilmemiş." />
        )}
        {rows.length > 0 && (
          <div className="rows" style={{ marginTop: 8 }}>
            <Row label="Toplam süre" value={duration(totalMinutes)} />
            <Row label="Toplam kazanç" value={money(totalPay)} total />
          </div>
        )}
      </Card>
    </>
  );
}

function LeaveReport({
  data,
  year,
  onAdd,
}: {
  data: AppData;
  year: number;
  onAdd: () => void;
}) {
  const balance = annualLeaveBalance(data, year);
  const usage = leaveUsage(data, year);
  return (
    <>
      <Card title={`${year} yıllık izin bakiyesi`}>
        <div className="stat-grid three">
          <Stat label="Hak" value={`${balance.entitlement} gün`} />
          <Stat label="Devreden" value={`${balance.carry} gün`} />
          <Stat label="Kullanılan" value={`${balance.used} gün`} />
        </div>
        <div className="rows" style={{ marginTop: 10 }}>
          <Row
            label="Kalan"
            value={`${balance.remaining} gün`}
            tone={balance.remaining < 0 ? 'neg' : 'pos'}
            total
          />
        </div>
        <Button variant="ghost" small block onClick={onAdd} className="no-print">
          İzin ekle
        </Button>
      </Card>

      <Card title="İzin kullanım raporu">
        {LEAVE_TYPES.filter((type) =>
          usage.records.some((row) => row.record.type === type),
        ).map((type) => {
          const typeRows = usage.records.filter((row) => row.record.type === type);
          const days = typeRows.reduce((sum, row) => sum + row.days, 0);
          const minutes = typeRows.reduce((sum, row) => sum + row.minutes, 0);
          return (
            <Row
              key={type}
              label={LEAVE_META[type].label}
              value={type === 'saatlik' ? `${duration(minutes)} · ${days} gün` : `${days} gün`}
            />
          );
        })}
        {!usage.records.length && <Empty title="İzin kullanımı yok" />}
        {usage.records.length > 0 && (
          <div className="rows" style={{ marginTop: 8 }}>
            <Row label="Toplam izin günü" value={`${usage.days} gün`} total />
            {usage.minutes > 0 && <Row label="Saatlik izin" value={duration(usage.minutes)} />}
          </div>
        )}
      </Card>

      <Card title="İzin kayıtları">
        {usage.records.length ? (
          usage.records.map((row) => (
            <Row
              key={row.record.id}
              label={`${LEAVE_META[row.record.type].label} · ${shortDateLabel(row.record.start)}${
                row.record.start !== row.record.end ? ` – ${shortDateLabel(row.record.end)}` : ''
              }`}
              value={
                row.record.type === 'saatlik'
                  ? duration(row.minutes)
                  : `${row.days} gün`
              }
              sub={row.record.note}
            />
          ))
        ) : (
          <Empty title="İzin kaydı yok" />
        )}
      </Card>
    </>
  );
}

function SalaryReport({
  data,
  summary,
  year,
}: {
  data: AppData;
  summary: MonthSummary;
  year: number;
}) {
  const totals = yearTotals(data, year);
  return (
    <>
      <Card title={`${MONTHS[summary.month]} ${summary.year} maaş dökümü`}>
        <div className="stat-grid three" style={{ marginBottom: 10 }}>
          <Stat label="Saatlik ücret" value={money(summary.hourly)} />
          <Stat label="Günlük ücret" value={money(summary.dailyRate)} />
          <Stat label="Normal maaş" value={money(summary.base)} />
        </div>
        <DetailedSummary summary={summary} settings={data.settings} />
      </Card>

      {summary.payroll && summary.salaryBasis === 'gross' && (
        <Card title="Bordro kesintileri (tahmini)">
          <Row label="Brüt toplam" value={money(summary.payroll.gross)} />
          <Row label="SGK işçi payı" value={`− ${money(summary.payroll.sgk)}`} tone="neg" />
          <Row
            label="İşsizlik sigortası işçi payı"
            value={`− ${money(summary.payroll.unemployment)}`}
            tone="neg"
          />
          <Row
            label="Gelir vergisi"
            value={`− ${money(summary.payroll.incomeTax)}`}
            tone="neg"
            sub={
              summary.payroll.incomeTaxExemption > 0
                ? `Asgari ücret istisnası: ${money(summary.payroll.incomeTaxExemption)}`
                : undefined
            }
          />
          <Row
            label="Damga vergisi"
            value={`− ${money(summary.payroll.stampTax)}`}
            tone="neg"
          />
          <Row label="Tahmini net" value={money(summary.payroll.net)} total />
          <div className="note">
            {summary.payroll.monthIndex}. ay kümülatif vergi matrahına göre hesaplanmıştır.
            Parametreler Araçlar → Mevzuat parametreleri bölümünde düzenlenebilir.
          </div>
        </Card>
      )}

      <Card title={`${year} yıllık kazanç raporu`}>
        <Row label="Toplam fazla mesai geliri" value={money(totals.otPay)} tone="pos" />
        <Row label="Toplam kesinti" value={money(totals.totalDeduction)} tone="neg" />
        <Row label="Tahmini net toplam" value={money(totals.net)} total />
        <div className="note">
          Net toplam, seçili yıldaki ayların kendi kümülatif vergi dilimleriyle hesaplanmış
          tahmini değeridir. Resmî bordro ile küçük yuvarlama farkları olabilir.
        </div>
      </Card>

      <div className="note no-print">
        Raporu PDF olarak kaydetmek için üstteki “PDF / Yazdır” düğmesini kullanın; tarayıcının
        yazdırma ekranından “PDF olarak kaydet” seçilebilir.
      </div>
    </>
  );
}

function buildShareText(
  data: AppData,
  tab: ReportTab,
  year: number,
  month: number,
  overtimeMonth: string,
): string {
  const summary = monthSummary(data, year, month);
  const lines: string[] = [
    `Mesai Defteri — ${MONTHS[month]} ${year}`,
    `Normal kazanç: ${money(summary.base)}`,
    `Fazla mesai: ${duration(summary.otTotalMin)} (${money(summary.otPay)})`,
    `Kesinti: ${money(summary.totalDeduction)}`,
    `Toplam: ${money(summary.earned)}`,
  ];

  if (tab === 'year') {
    const totals = yearTotals(data, year);
    lines.push(
      `Yıllık fazla mesai: ${duration(totals.otTotalMin)}`,
      `Yıllık mesai geliri: ${money(totals.otPay)}`,
      `Yıllık tahmini net: ${money(totals.net)}`,
      `İzin günü: ${totals.leaveDayCount}`,
    );
  } else if (tab === 'leave') {
    const balance = annualLeaveBalance(data, year);
    const usage = leaveUsage(data, year);
    lines.push(
      `Yıllık izin hakkı: ${balance.entitlement} gün`,
      `Kullanılan: ${usage.days} gün`,
      `Kalan bakiye: ${balance.remaining} gün`,
    );
  } else if (tab === 'overtime') {
    const rows = overtimeRows(data, year, overtimeMonth === 'all' ? null : Number(overtimeMonth));
    lines.push(
      `Mesai kayıt sayısı: ${rows.length}`,
      `Toplam mesai: ${duration(rows.reduce((sum, row) => sum + row.minutes, 0))}`,
      `Toplam mesai kazancı: ${money(rows.reduce((sum, row) => sum + row.pay, 0))}`,
    );
  } else if (tab === 'daily') {
    const days = buildMonthDays(data, year, month).filter((day) => day.entry || day.leave);
    lines.push(
      `Kayıtlı gün: ${days.length}`,
      ...days.slice(0, 20).map(
        (day) =>
          `${shortDateLabel(day.key)}: ${day.otMinutes > 0 ? `+${shortDuration(day.otMinutes)} mesai` : day.leave ? LEAVE_META[day.leave.type].label : 'çalışma'}`,
      ),
    );
  } else if (tab === 'salary') {
    const totals = yearTotals(data, year);
    lines.push(
      `Yaklaşık brüt: ${money(summary.gross)}`,
      `Yıl toplamı tahmini net: ${money(totals.net)}`,
    );
  }

  return lines.join('\n');
}
