import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildMonthDays, monthSummary } from '../lib/calc';
import { DAY_STATUS_META, LEAVE_META, LEAVE_TYPES } from '../defaults';
import { duration, money } from '../lib/format';
import {
  CalendarGrid,
  Card,
  Empty,
  MonthNav,
  PageTop,
  Row,
  Stat,
  Tabs,
} from '../components/ui';

type CalendarTab = 'takvim' | 'ozet' | 'kayitlar';

const CALENDAR_TABS: { value: CalendarTab; label: string }[] = [
  { value: 'takvim', label: 'Takvim' },
  { value: 'ozet', label: 'Ay özeti' },
  { value: 'kayitlar', label: 'Kayıtlar' },
];

export default function CalendarScreen() {
  const { data, ui, stepMonth, setView, openDay, clearMonth, notify, navigate } = useApp();
  const { year, month } = ui.view;
  const [tab, setTab] = useState<CalendarTab>('takvim');

  const days = useMemo(() => buildMonthDays(data, year, month), [data, year, month]);
  const summary = monthSummary(data, year, month);
  const recorded = days.filter((day) => day.entry || day.leave);

  const reset = () => {
    const now = new Date();
    setView(now.getFullYear(), now.getMonth());
  };

  const removeMonth = () => {
    const confirmed = window.confirm(
      `${year} ${month + 1}. ayın tüm mesai ve izin kayıtları silinsin mi? Bu işlem geri alınamaz. Yedek almanız önerilir.`,
    );
    if (!confirmed) return;
    clearMonth(year, month);
    notify('Ayın kayıtları silindi.');
  };

  return (
    <>
      <PageTop title="Takvim" onBack={() => navigate('home')} />
      <MonthNav
        year={year}
        month={month}
        onPrev={() => stepMonth(-1)}
        onNext={() => stepMonth(1)}
        onToday={reset}
      />

      <Tabs value={tab} onChange={setTab} options={CALENDAR_TABS} />

      {tab === 'takvim' && (
        <Card>
          <CalendarGrid days={days} year={year} month={month} onSelect={openDay} shifts={data.shifts} />
          <div className="legend">
            <span>
              <i style={{ background: DAY_STATUS_META.calisma.color }} />
              Normal çalışma
            </span>
            <span>
              <i style={{ background: DAY_STATUS_META.mesai.color }} />
              Fazla mesai
            </span>
            <span>
              <i style={{ background: DAY_STATUS_META['hafta-tatili'].color }} />
              Hafta tatili
            </span>
            <span>
              <i style={{ background: DAY_STATUS_META.tatil.color }} />
              Resmi tatil
            </span>
            <span>
              <i style={{ background: DAY_STATUS_META.yok.color }} />
              Gelmedi
            </span>
            <span>
              <i style={{ background: '#8e5cf7' }} />
              Vardiya
            </span>
            {LEAVE_TYPES.map((type) => (
              <span key={type}>
                <i style={{ background: LEAVE_META[type].color }} />
                {LEAVE_META[type].label}
              </span>
            ))}
          </div>
        </Card>
      )}

      {tab === 'ozet' && (
        <Card title="Ay özeti">
          <div className="stat-grid">
            <Stat label="Fazla mesai" value={duration(summary.otTotalMin)} />
            <Stat label="Mesai kazancı" value={money(summary.otPay)} accent />
          </div>
          <div className="rows" style={{ marginTop: 10 }}>
            <Row label="Toplam alacak" value={money(summary.earned)} />
            <Row label="Kesinti" value={money(summary.totalDeduction)} tone="neg" />
            <Row label="İzin günü" value={`${summary.leaveDayCount} gün`} />
            <Row label="Kayıtlı çalışma" value={duration(summary.workedMin)} />
          </div>
          <button className="link-btn danger no-print" onClick={removeMonth}>
            Bu ayın kayıtlarını sil
          </button>
        </Card>
      )}

      {tab === 'kayitlar' && (
        <Card title="Bu ayın kayıtları">
          {recorded.length ? (
            recorded.map((day) => (
              <button
                key={day.key}
                className="entry-row"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => openDay(day.key)}
              >
                <span className="entry-main">
                  <span className="entry-title">
                    <b>{day.day}</b>
                    {day.leave ? (
                      <span className="badge">
                        <i style={{ background: LEAVE_META[day.leave.type].color }} />
                        {LEAVE_META[day.leave.type].label}
                        {day.leave.type === 'saatlik' && day.leave.minutesPerDay
                          ? ` · ${duration(day.leave.minutesPerDay)}`
                          : ''}
                      </span>
                    ) : day.entry?.ab ? (
                      <span className="badge">
                        <i style={{ background: DAY_STATUS_META.yok.color }} />
                        Gelmedi
                      </span>
                    ) : day.entry?.rt ? (
                      <span className="badge">
                        <i style={{ background: DAY_STATUS_META.tatil.color }} />
                        Resmi tatil
                      </span>
                    ) : day.otMinutes > 0 ? (
                      <span className="badge">
                        <i style={{ background: DAY_STATUS_META.mesai.color }} />+{duration(day.otMinutes)}
                      </span>
                    ) : (
                      <span className="badge">Çalışma</span>
                    )}
                  </span>
                  <span className="entry-meta">
                    {day.entry?.gi && day.entry?.ci
                      ? `${day.entry.gi}–${day.entry.ci}`
                      : 'Saat girilmedi'}
                    {day.shiftId
                      ? ` · ${data.shifts.find((shift) => shift.id === day.shiftId)?.name ?? 'Vardiya'}`
                      : ''}
                    {day.workedMinutes != null ? ` · ${duration(day.workedMinutes)}` : ''}
                    {day.entry?.df ? ` · eksik ${duration(day.entry.df)}` : ''}
                    {day.entry?.n ? ` · ${day.entry.n}` : ''}
                  </span>
                </span>
                <span className="entry-val muted">›</span>
              </button>
            ))
          ) : (
            <Empty
              title="Bu ay kayıt yok"
              sub="Takvimden bir güne dokunarak mesai veya izin ekleyin."
            />
          )}
        </Card>
      )}
    </>
  );
}
