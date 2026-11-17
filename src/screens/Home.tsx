import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import {
  annualLeaveBalance,
  buildMonthDays,
  monthSummary,
  overtimePayForEntry,
} from '../lib/calc';
import { duration, money, monthTitle } from '../lib/format';
import { MONTHS, shortDateLabel, todayKey } from '../lib/date';
import { LEAVE_META } from '../defaults';
import { Button, CalendarGrid, Card, Icon, Row, Stat, Tabs } from '../components/ui';
import type { AppData, DayEntry } from '../types';

type HomeTab = 'ay' | 'takvim' | 'kayitlar' | 'araclar' | 'kisayollar';

const HOME_TABS: { value: HomeTab; label: string }[] = [
  { value: 'ay', label: 'Bu ay' },
  { value: 'takvim', label: 'Takvim' },
  { value: 'kayitlar', label: 'Son kayıtlar' },
  { value: 'araclar', label: 'Araçlar' },
  { value: 'kisayollar', label: 'Kısayollar' },
];

export default function Home() {
  const { data, navigate, openDay, setEntry, notify } = useApp();
  const [hidden, setHidden] = useState(true);
  const [tab, setTab] = useState<HomeTab>('ay');

  useEffect(() => {
    setHidden(true);
  }, [tab]);

  useEffect(() => {
    const hideWhenLeaving = () => {
      if (document.visibilityState !== 'visible') setHidden(true);
    };
    document.addEventListener('visibilitychange', hideWhenLeaving);
    return () => document.removeEventListener('visibilitychange', hideWhenLeaving);
  }, []);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const summary = useMemo(() => monthSummary(data, year, month), [data, year, month]);
  const days = useMemo(() => buildMonthDays(data, year, month), [data, year, month]);
  const balance = annualLeaveBalance(data, year);
  const today = todayKey();
  const todayInfo = days.find((day) => day.isToday);

  const needsSalary =
    data.settings.salaryMode === 'monthly'
      ? data.settings.monthlySalary <= 0
      : data.settings.hourlyRate <= 0;

  const recent = useMemo(() => recentEntries(data), [data]);

  const quickAdd = (minutes: number) => {
    const entry = data.entries[today] ?? {};
    setEntry(today, {
      ...entry,
      ab: undefined,
      ot: (entry.ot ?? 0) + minutes,
    });
    notify(`Bugüne ${duration(minutes)} fazla mesai eklendi.`);
  };

  return (
    <>
      <header className="home-head">
        <div className="muted">
          {data.profile.workplace || 'Mesai Defteri'}
          {data.profile.position ? ` · ${data.profile.position}` : ''}
        </div>
        <h1>Merhaba{data.profile.name ? `, ${data.profile.name}` : ''}</h1>
      </header>

      <section className="hero">
        <div className="hero-label">{monthTitle(year, month)} tahmini net maaş</div>
        <div
          className={`hero-amount ${hidden ? 'hidden' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={hidden ? 'Tahmini net maaşı göster' : 'Tahmini net maaşı gizle'}
          aria-pressed={!hidden}
          onClick={() => setHidden((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setHidden((value) => !value);
            }
          }}
        >
          {money(summary.net)}
        </div>
        <div className="hero-privacy-hint" aria-live="polite">
          {hidden ? 'Tutarı görmek için dokunun' : 'Tutar şu an görünür'}
        </div>
        <div className="chips">
          <span className="chip">
            Mesai <strong>{duration(summary.otTotalMin)}</strong>
          </span>
          <span className="chip">
            Mesai kazancı <strong>{money(summary.otPay)}</strong>
          </span>
          <span className="chip">
            Yıllık izin <strong>{balance.remaining} gün</strong>
          </span>
        </div>
        <div className="hero-foot">
          <span>
            {todayInfo
              ? todayInfo.leave
                ? `${LEAVE_META[todayInfo.leave.type].label} günü`
                : todayInfo.otMinutes > 0
                  ? `Bugün ${duration(todayInfo.otMinutes)} mesai`
                  : todayInfo.workedMinutes != null
                    ? `Bugün ${duration(todayInfo.workedMinutes)} çalışma`
                    : 'Bugün için kayıt yok'
              : 'Bugün için kayıt yok'}
          </span>
          <button onClick={() => openDay(today)}>Bugünü işle ›</button>
        </div>
      </section>

      <div className="section-title">
        <h2>Hızlı mesai</h2>
        <span className="muted">{shortDateLabel(today)}</span>
      </div>
      <div className="quick-row">
        {[30, 60, 120, 180].map((minutes) => (
          <button key={minutes} className="quick" onClick={() => quickAdd(minutes)}>
            <b>+{minutes < 60 ? `${minutes} dk` : `${minutes / 60} sa`}</b>
            <span>bugüne ekle</span>
          </button>
        ))}
      </div>

      {needsSalary && (
        <Card>
          <div className="rows">
            <Row label="Maaş bilgisi eklenmedi" value="Kazanç hesabı için gerekli" tone="warn" />
          </div>
          <Button block small onClick={() => navigate('settings')} className="no-print">
            Maaş ayarlarını aç
          </Button>
        </Card>
      )}

      <Tabs value={tab} onChange={setTab} options={HOME_TABS} />

      {tab === 'ay' && (
        <>
          <div className="stat-grid">
            <Stat label="Fazla mesai" value={duration(summary.otTotalMin)} />
            <Stat label="Mesai kazancı" value={money(summary.otPay)} accent />
            <Stat label="İzin günü" value={`${summary.leaveDayCount} gün`} />
            <Stat label="Kesinti" value={money(summary.totalDeduction)} tone="neg" />
          </div>
          <Card
            title={`${MONTHS[month]} özeti`}
            action={
              <button className="link-btn" onClick={() => navigate('reports')}>
                Raporlar ›
              </button>
            }
          >
            <div className="rows">
              <Row label="Toplam alacak" value={money(summary.earned)} />
              <Row label="Kayıtlı çalışma" value={duration(summary.workedMin)} />
              <Row label="Beklenen süre" value={duration(summary.expectedMin)} />
              <Row
                label="Yıllık izin bakiyesi"
                value={`${balance.remaining} gün`}
                tone={balance.remaining < 0 ? 'neg' : undefined}
              />
            </div>
          </Card>
        </>
      )}

      {tab === 'takvim' && (
        <Card
          title={`${MONTHS[month]} takvimi`}
          action={
            <button className="link-btn" onClick={() => navigate('calendar')}>
              Takvimi aç ›
            </button>
          }
        >
          <CalendarGrid days={days} year={year} month={month} onSelect={openDay} shifts={data.shifts} />
        </Card>
      )}

      {tab === 'kayitlar' && (
        <Card
          title="Son kayıtlar"
          action={
            <button className="link-btn" onClick={() => navigate('calendar')}>
              Tümü ›
            </button>
          }
        >
          {recent.length ? (
            recent.map(({ key, entry }) => {
              const day = days.find((item) => item.key === key);
              const shift = data.shifts.find((item) => item.id === entry.shiftId);
              return (
                <button
                  key={key}
                  className="entry-row"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => openDay(key)}
                >
                  <span className="entry-main">
                    <span className="entry-title">
                      <b>{shortDateLabel(key)}</b>
                      {entry.ot ? (
                        <span className="badge">
                          <i style={{ background: '#2f9e6a' }} />+{duration(entry.ot)} mesai
                        </span>
                      ) : entry.ab ? (
                        <span className="badge">
                          <i style={{ background: '#b4232c' }} />
                          Gelmedi
                        </span>
                      ) : entry.rt ? (
                        <span className="badge">
                          <i style={{ background: '#d98324' }} />
                          Resmi tatil
                        </span>
                      ) : null}
                    </span>
                    <span className="entry-meta">
                      {entry.gi && entry.ci ? `${entry.gi}–${entry.ci}` : 'Saat girilmedi'}
                      {shift ? ` · ${shift.name}` : ''}
                      {day?.workedMinutes != null ? ` · ${duration(day.workedMinutes)}` : ''}
                      {entry.n ? ` · ${entry.n}` : ''}
                    </span>
                  </span>
                  <span className="entry-val">
                    {entry.ot ? (
                      <span className="pos">{money(overtimePayForEntry(data, key, entry))}</span>
                    ) : (
                      <span className="muted">›</span>
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="empty">
              <b>Henüz kayıt yok</b>
              <span>Yukarıdaki hızlı butonlarla bugünün mesaisini ekleyebilirsin.</span>
            </div>
          )}
        </Card>
      )}

      {tab === 'araclar' && (
        <>
          <div className="tool-grid">
            {[
              { label: 'Kıdem tazminatı', sub: 'Tavan ve damga dahil' },
              { label: 'İhbar tazminatı', sub: 'Kıdeme göre süre' },
              { label: 'Brüt ↔ net', sub: 'Maaş dönüşümü' },
              { label: 'İşsizlik ödeneği', sub: 'Son 4 ay ortalaması' },
            ].map((tool) => (
              <button key={tool.label} className="tool-card" onClick={() => navigate('tools')}>
                <b>{tool.label}</b>
                <span>{tool.sub}</span>
              </button>
            ))}
          </div>
          <Card>
            <Button small variant="ghost" block onClick={() => navigate('tools')}>
              Tüm hesaplama araçları
            </Button>
          </Card>
        </>
      )}

      {tab === 'kisayollar' && (
        <Card>
          <div className="rows">
            <button className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('leaves')}>
              <span className="lbl">İzin ekle / yıllık izin bakiyesi</span>
              <span className="val">
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
            <button className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('reports')}>
              <span className="lbl">Aylık ve yıllık raporlar</span>
              <span className="val">
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
            <button className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('settings')}>
              <span className="lbl">Maaş, çalışma düzeni ve hatırlatıcılar</span>
              <span className="val">
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

function recentEntries(data: AppData): { key: string; entry: DayEntry }[] {
  return Object.entries(data.entries)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 4)
    .map(([key, entry]) => ({ key, entry }));
}
