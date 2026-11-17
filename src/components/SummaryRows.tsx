import type { MonthSummary } from '../lib/calc';
import type { Settings } from '../types';
import { duration, money } from '../lib/format';
import { Row } from './ui';

export function DetailedSummary({
  summary,
  settings,
}: {
  summary: MonthSummary;
  settings: Settings;
}) {
  const basis = summary.salaryBasis === 'gross' ? 'Brüt' : 'Net';
  return (
    <div className="rows">
      <Row
        label={
          summary.salaryMode === 'hourly'
            ? 'Normal kazanç (saatlik × bölen)'
            : 'Aylık normal kazanç'
        }
        value={money(summary.base)}
        sub={basis === 'Brüt' ? 'Brüt tutar' : 'Net tutar'}
      />
      <Row
        label={`Fazla mesai (${duration(summary.otNormalMin)})`}
        value={money(summary.otNormalPay)}
        tone="pos"
      />
      <Row
        label={`Hafta sonu mesaisi (${duration(summary.otWeekendMin)})`}
        value={money(summary.otWeekendPay)}
        tone="pos"
      />
      <Row
        label={`Resmi tatil mesaisi (${duration(summary.otHolidayMin)})`}
        value={money(summary.otHolidayPay)}
        tone="pos"
      />
      <Row label="Toplam ek kazanç" value={money(summary.otPay)} strong />
      {summary.missingMin > 0 && (
        <Row
          label="Eksik saat kesintisi"
          value={`− ${money(summary.missingPay)}`}
          sub={duration(summary.missingMin)}
          tone="neg"
        />
      )}
      {summary.absentDays > 0 && (
        <Row
          label="Gelmediği günler"
          value={`− ${money(summary.absentPay)}`}
          sub={`${summary.absentDays} gün`}
          tone="neg"
        />
      )}
      {summary.leaveDeduction > 0 && (
        <Row
          label="Kesintili izin"
          value={`− ${money(summary.leaveDeduction)}`}
          sub={
            summary.leaveDeductionDays +
            (summary.hourlyLeaveMin > 0
              ? ` gün + ${duration(summary.hourlyLeaveMin)}`
              : ' gün')
          }
          tone="neg"
        />
      )}
      {summary.otherDeduction > 0 && (
        <Row
          label={settings.deductionName || 'Diğer kesinti'}
          value={`− ${money(summary.otherDeduction)}`}
          tone="neg"
        />
      )}
      <Row label="Toplam alacak" value={money(summary.earned)} total />
      {summary.salaryBasis === 'gross' ? (
        <Row label="Tahmini net maaş" value={money(summary.net)} sub="Vergi ve primler düşülmüş" />
      ) : (
        <Row label="Yaklaşık brüt" value={money(summary.gross)} sub="Bordro modeline göre" />
      )}
    </div>
  );
}
