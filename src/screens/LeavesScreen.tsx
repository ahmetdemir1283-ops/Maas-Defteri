import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { annualLeaveBalance, expandLeave } from '../lib/calc';
import { LEAVE_META, LEAVE_TYPES } from '../defaults';
import { duration } from '../lib/format';
import { fromKey, shortDateLabel, todayKey } from '../lib/date';
import {
  Button,
  Card,
  Empty,
  Field,
  NumInput,
  PageTop,
  Row,
  Stat,
  Tabs,
  TextField,
  Toggle,
  YearNav,
} from '../components/ui';
import type { LeaveType } from '../types';

export default function LeavesScreen() {
  const {
    data,
    ui,
    addLeave,
    updateLeave,
    removeLeave,
    notify,
    setView,
    clearLeavePrefill,
    navigate,
  } = useApp();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<LeaveType>('yillik');
  const [start, setStart] = useState(ui.leavePrefill?.start ?? todayKey());
  const [end, setEnd] = useState(ui.leavePrefill?.end ?? '');
  const [hours, setHours] = useState(0);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'form' | 'bakiye' | 'kayitlar'>('form');

  useEffect(() => {
    if (!ui.leavePrefill) return;
    setStart(ui.leavePrefill.start);
    setEnd(ui.leavePrefill.end);
    setType('yillik');
    setEditingId(null);
    setHours(0);
    setNote('');
    setTab('form');
    clearLeavePrefill();
  }, [ui.leavePrefill, clearLeavePrefill]);

  const year = ui.view.year;
  const balance = annualLeaveBalance(data, year);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const records = data.leaves
    .filter((record) => record.start <= yearEnd && record.end >= yearStart)
    .sort((a, b) => a.start.localeCompare(b.start));

  const resetForm = () => {
    setEditingId(null);
    setType('yillik');
    setStart(todayKey());
    setEnd('');
    setHours(0);
    setSkipWeekends(true);
    setNote('');
  };

  const save = () => {
    if (!start) {
      notify('Başlangıç tarihini seçin.');
      return;
    }
    const finish = end || start;
    if (finish < start) {
      notify('Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }
    if (Math.round((fromKey(finish).getTime() - fromKey(start).getTime()) / 86400000) > 366) {
      notify('En fazla 1 yıllık (366 gün) izin aralığı girilebilir.');
      return;
    }
    const minutes = Math.round(hours * 60);
    if (type === 'saatlik' && minutes <= 0) {
      notify('Saatlik izin için süre girin.');
      return;
    }
    const preview = expandLeave(
      {
        id: 'preview',
        type,
        start,
        end: finish,
        minutesPerDay: minutes || undefined,
        skipWeekends,
        createdAt: '',
      },
      data.settings.weeklyWorkDays,
    );
    if (!preview.length) {
      notify('Seçilen aralıkta iş günü yok. Hafta sonu atlama seçeneğini kontrol edin.');
      return;
    }

    const payload = {
      type,
      start,
      end: finish,
      minutesPerDay: type === 'saatlik' ? minutes : undefined,
      note: note.trim() || undefined,
      skipWeekends,
    };

    if (editingId) {
      updateLeave(editingId, payload);
      notify('İzin güncellendi.');
    } else {
      addLeave(payload);
      notify(`${preview.length} gün izin kaydedildi.`);
    }
    const date = fromKey(start);
    setView(date.getFullYear(), date.getMonth());
    resetForm();
  };

  const edit = (id: string) => {
    const record = data.leaves.find((item) => item.id === id);
    if (!record) return;
    setEditingId(record.id);
    setType(record.type);
    setStart(record.start);
    setEnd(record.end);
    setHours((record.minutesPerDay ?? 0) / 60);
    setSkipWeekends(record.skipWeekends);
    setNote(record.note ?? '');
    setTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = (id: string) => {
    if (!window.confirm('Bu izin kaydı silinsin mi?')) return;
    removeLeave(id);
    if (editingId === id) resetForm();
    notify('İzin kaydı silindi.');
  };

  const deducted = data.settings.leaveDeductions[type];

  return (
    <>
      <PageTop title="İzinler" onBack={() => navigate('home')} />

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'form', label: editingId ? 'İzni düzenle' : 'Yeni izin' },
          { value: 'bakiye', label: 'Bakiye' },
          { value: 'kayitlar', label: 'Kayıtlar' },
        ]}
      />

      {tab === 'bakiye' && (
        <>
          <YearNav
            year={year}
            onPrev={() => setView(year - 1, ui.view.month)}
            onNext={() => setView(year + 1, ui.view.month)}
          />
      <Card title={`${year} yıllık izin bakiyesi`}>
        <div className="stat-grid three">
          <Stat label="Hak" value={`${balance.entitlement} gün`} />
          <Stat label="Devreden" value={`${balance.carry} gün`} />
          <Stat label="Kullanılan" value={`${balance.used} gün`} />
        </div>
        <div className="rows" style={{ marginTop: 10 }}>
          <Row
            label="Kalan bakiye"
            value={`${balance.remaining} gün`}
            tone={balance.remaining < 0 ? 'neg' : 'pos'}
            total
          />
        </div>
        <div className="note">
          Yıllık ücretli izin günleri kaydedildikçe bakiyeden otomatik düşer. Hak ve devreden gün
          Ayarlar’dan düzenlenebilir.
        </div>
        {balance.remaining < 0 && (
          <div className="note warn">
            Yıllık izin bakiyesi negatif: {Math.abs(balance.remaining)} gün fazla kayıt var. İzin
            hakkını veya kayıtları kontrol edin.
          </div>
        )}
      </Card>
        </>
      )}

      {tab === 'form' && (
      <Card title={editingId ? 'İzni düzenle' : 'Yeni izin'}>
        <label className="muted">İzin türü</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          {LEAVE_TYPES.map((item) => (
            <button
              key={item}
              type="button"
              className={`btn sm ${type === item ? 'primary' : 'ghost'}`}
              style={{ justifyContent: 'flex-start' }}
              onClick={() => setType(item)}
            >
              {LEAVE_META[item].label}
            </button>
          ))}
        </div>
        <div className="note">
          <strong>{LEAVE_META[type].label}</strong> ·{' '}
          {deducted ? 'maaştan kesilir' : 'maaştan kesilmez'}
          {type === 'saatlik' ? ' · günlük süre girilir' : ''}
        </div>

        <div className="two">
          <TextField
            label="Başlangıç"
            type="date"
            value={start}
            onChange={(value) => setStart(value)}
          />
          <TextField
            label="Bitiş (tek gün için boş)"
            type="date"
            value={end}
            onChange={(value) => setEnd(value)}
          />
        </div>

        {type === 'saatlik' && (
          <NumInput
            label="Günlük izin süresi"
            value={hours}
            onChange={setHours}
            suffix="sa"
            hint="Örn. 2 saat. Her izin günü için aynı süre uygulanır."
          />
        )}

        <Toggle
          label="Aralıkta hafta sonlarını atla"
          description="Kapalıysa hafta tatili günleri de izne dahil edilir."
          checked={skipWeekends}
          onChange={setSkipWeekends}
        />

        <Field label="Not">
          <textarea
            className="input"
            value={note}
            placeholder="Örn. yıllık izin, doktor raporu…"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={save}>
            {editingId ? 'Güncelle' : 'İzni kaydet'}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={resetForm}>
              Vazgeç
            </Button>
          )}
        </div>
      </Card>
      )}

      {tab === 'kayitlar' && (
        <>
          <YearNav
            year={year}
            onPrev={() => setView(year - 1, ui.view.month)}
            onNext={() => setView(year + 1, ui.view.month)}
          />
      <Card title={`${year} izin kayıtları`}>
        {records.length ? (
          records.map((record) => {
            const dayKeys = expandLeave(record, data.settings.weeklyWorkDays);
            const minutes =
              record.type === 'saatlik'
                ? dayKeys.length * (record.minutesPerDay ?? 0)
                : 0;
            return (
              <div key={record.id} className="entry-row">
                <div className="entry-main">
                  <div className="entry-title">
                    <b>{LEAVE_META[record.type].label}</b>
                    <span className="badge">
                      <i style={{ background: LEAVE_META[record.type].color }} />
                      {record.start === record.end
                        ? shortDateLabel(record.start)
                        : `${shortDateLabel(record.start)} – ${shortDateLabel(record.end)}`}
                    </span>
                  </div>
                  <div className="entry-meta">
                    {record.type === 'saatlik'
                      ? `${duration(minutes)} (${dayKeys.length} gün)`
                      : `${dayKeys.length} gün`}
                    {' · '}
                    {data.settings.leaveDeductions[record.type] ? 'maaştan kesilir' : 'ücretli'}
                    {record.note ? ` · ${record.note}` : ''}
                  </div>
                </div>
                <div className="entry-val">
                  <button
                    className="icon-btn"
                    style={{ display: 'inline-grid', width: 32, height: 32 }}
                    onClick={() => edit(record.id)}
                    aria-label="İzni düzenle"
                  >
                    <span style={{ fontSize: 12 }}>Düzenle</span>
                  </button>
                  <button
                    className="link-btn danger"
                    style={{ display: 'block', marginTop: 6 }}
                    onClick={() => remove(record.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <Empty title="Kayıt yok" sub="Yukarıdaki formdan izin ekleyebilirsin." />
        )}
      </Card>

      <div className="note">
        İzin günleri seçili yılın bakiyesine işlenir. Ücretli/ücretsiz ayrımı maaş hesabında
        Ayarlar’daki “maaştan kesilir” seçeneklerine göre dikkate alınır. Kesintili izinlerde günlük
        kesinti = aylık ücret ÷ 30’dur.
      </div>
        </>
      )}
    </>
  );
}
