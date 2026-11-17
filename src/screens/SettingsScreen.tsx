import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { ChangeEvent } from 'react';
import {
  getNotificationPermission,
  notificationPermission,
  requestNotificationPermission,
  sendNotification,
  syncNativeReminders,
  useApp,
} from '../store';
import type { PermissionState } from '../store';
import { ACCENTS, LEAVE_META, LEAVE_TYPES, THEME_MODES } from '../defaults';
import { money } from '../lib/format';
import { MONTHS } from '../lib/date';
import { downloadBackup } from '../lib/storage';
import type { SalaryBasis, SalaryMode, SalaryPeriod } from '../types';
import { weekLabel } from '../lib/labels';
import {
  Button,
  Card,
  NumInput,
  PageTop,
  SelectField,
  Segmented,
  Tabs,
  TextField,
  Toggle,
} from '../components/ui';

type SettingsTab =
  | 'profil'
  | 'maas'
  | 'gecmis'
  | 'duzen'
  | 'katsayi'
  | 'izin'
  | 'vardiya'
  | 'gorunum'
  | 'hatirlatici'
  | 'yedek'
  | 'hakkinda';

const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: 'profil', label: 'Profil' },
  { value: 'maas', label: 'Maaş' },
  { value: 'gecmis', label: 'Maaş geçmişi' },
  { value: 'duzen', label: 'Çalışma' },
  { value: 'katsayi', label: 'Katsayı' },
  { value: 'izin', label: 'İzin' },
  { value: 'vardiya', label: 'Vardiya' },
  { value: 'gorunum', label: 'Görünüm' },
  { value: 'hatirlatici', label: 'Hatırlatıcı' },
  { value: 'yedek', label: 'Yedek' },
  { value: 'hakkinda', label: 'Hakkında' },
];

function periodLabel(from: string): string {
  const [year, month] = from.split('-').map(Number);
  return `${MONTHS[(month || 1) - 1]} ${year}`;
}

export default function SettingsScreen() {
  const {
    data,
    notify,
    navigate,
    updateSettings,
    saveSalaryPeriod,
    removeSalaryPeriod,
    updateProfile,
    updateTheme,
    updateReminders,
    addShift,
    removeShift,
    importData,
    resetAll,
  } = useApp();
  const settings = data.settings;
  const [minWageCount, setMinWageCount] = useState(0);
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [permission, setPermission] = useState<PermissionState>(() => notificationPermission());
  useEffect(() => {
    let active = true;
    void getNotificationPermission().then((result) => {
      if (active) setPermission(result);
    });
    return () => { active = false; };
  }, []);
  const [tab, setTab] = useState<SettingsTab>('profil');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [periodMonth, setPeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodMode, setPeriodMode] = useState<SalaryMode>(settings.salaryMode);
  const [periodBasis, setPeriodBasis] = useState<SalaryBasis>(settings.salaryBasis);
  const [periodSalary, setPeriodSalary] = useState(settings.monthlySalary);
  const [periodHourly, setPeriodHourly] = useState(settings.hourlyRate);
  const [periodDivisor, setPeriodDivisor] = useState(settings.monthlyHourDivisor);

  const applyMinimumWage = () => {
    const value =
      Math.round(((data.legal.minWageNet * Math.max(0, minWageCount)) / 12) * 100) / 100;
    updateSettings({ monthlySalary: value, salaryMode: 'monthly', salaryBasis: 'net' });
    notify(`Aylık maaş ${money(value)} olarak ayarlandı.`);
  };

  const askPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      notify('Bildirim izni verildi.');
      void syncNativeReminders(data);
    }
    else if (result === 'unsupported')
      notify('Bu tarayıcı bildirimleri desteklemiyor; uygulama içi uyarı gösterilecek.');
    else notify('Bildirim izni verilmedi; uygulama içi uyarı gösterilecek.');
  };

  const testNotification = async () => {
    const sent = await sendNotification('Mesai Defteri', 'Bu bir deneme bildirimidir.');
    if (sent) notify('Deneme bildirimi gönderildi.');
    else notify('Bildirim gönderilemedi; uygulama içi uyarı kullanılıyor.');
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importData(String(reader.result ?? ''));
      if (result.ok) {
        notify('Yedek geri yüklendi.');
        window.scrollTo({ top: 0 });
      } else {
        notify(result.error ?? 'Yedek yüklenemedi.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const startEditPeriod = (period: SalaryPeriod) => {
    setEditingId(period.id);
    setPeriodMonth(period.from);
    setPeriodMode(period.mode);
    setPeriodBasis(period.basis);
    setPeriodSalary(period.monthlySalary);
    setPeriodHourly(period.hourlyRate);
    setPeriodDivisor(period.monthlyHourDivisor);
  };

  const resetPeriodForm = () => {
    const now = new Date();
    setEditingId(null);
    setPeriodMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setPeriodMode(settings.salaryMode);
    setPeriodBasis(settings.salaryBasis);
    setPeriodSalary(settings.monthlySalary);
    setPeriodHourly(settings.hourlyRate);
    setPeriodDivisor(settings.monthlyHourDivisor);
  };

  const applyPeriod = () => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
      notify('Geçerli bir ay seçin.');
      return;
    }
    saveSalaryPeriod({
      id: editingId ?? `salary_${periodMonth}`,
      from: periodMonth,
      mode: periodMode,
      basis: periodBasis,
      monthlySalary: Math.max(0, periodSalary),
      hourlyRate: Math.max(0, periodHourly),
      monthlyHourDivisor: Math.max(1, periodDivisor),
    });
    notify(editingId ? 'Maaş dönemi güncellendi.' : 'Maaş dönemi eklendi.');
    resetPeriodForm();
  };

  const addNewShift = () => {
    const name = shiftName.trim();
    if (!name) {
      notify('Vardiya adı girin.');
      return;
    }
    addShift({ name, start: shiftStart, end: shiftEnd });
    setShiftName('');
    notify('Vardiya eklendi.');
  };

  return (
    <>
      <PageTop title="Ayarlar" onBack={() => navigate('home')} />

      <Tabs value={tab} onChange={setTab} options={SETTINGS_TABS} />

      {tab === 'profil' && (
      <Card title="Profil">
        <TextField
          label="Adın"
          value={data.profile.name}
          onChange={(value) => updateProfile({ name: value })}
        />
        <TextField
          label="İş yeri"
          value={data.profile.workplace}
          onChange={(value) => updateProfile({ workplace: value })}
        />
        <TextField
          label="Pozisyon"
          value={data.profile.position}
          onChange={(value) => updateProfile({ position: value })}
        />
        <TextField
          label="İşe başlama tarihi"
          type="date"
          value={data.profile.startDate}
          onChange={(value) => updateProfile({ startDate: value })}
        />
      </Card>

      )}

      {tab === 'maas' && (
      <Card title="Maaş ve ücret">
        <label className="muted">Hesaplama yöntemi</label>
        <div style={{ marginTop: 6 }}>
          <Segmented
            value={settings.salaryMode}
            onChange={(value) => updateSettings({ salaryMode: value })}
            options={[
              { value: 'monthly', label: 'A: Aylık maaş' },
              { value: 'hourly', label: 'B: Saatlik ücret' },
            ]}
          />
        </div>
        <label className="muted" style={{ display: 'block', marginTop: 10 }}>
          Maaş türü
        </label>
        <div style={{ marginTop: 6 }}>
          <Segmented
            value={settings.salaryBasis}
            onChange={(value) => updateSettings({ salaryBasis: value })}
            options={[
              { value: 'net', label: 'Net' },
              { value: 'gross', label: 'Brüt' },
            ]}
          />
        </div>

        {settings.salaryMode === 'monthly' ? (
          <NumInput
            label="Aylık maaş"
            value={settings.monthlySalary}
            onChange={(value) => updateSettings({ monthlySalary: value })}
            suffix="₺"
          />
        ) : (
          <NumInput
            label="Saatlik ücret"
            value={settings.hourlyRate}
            onChange={(value) => updateSettings({ hourlyRate: value })}
            suffix="₺"
          />
        )}

        <div className="two">
          <NumInput
            label="Günlük çalışma saati"
            value={settings.dailyHours}
            onChange={(value) => updateSettings({ dailyHours: value })}
            suffix="sa"
          />
          <NumInput
            label="Aylık saat böleni"
            value={settings.monthlyHourDivisor}
            onChange={(value) => updateSettings({ monthlyHourDivisor: value })}
            suffix="sa"
          />
        </div>

        <div className="note">
          Saatlik ücret {money(settings.monthlyHourDivisor > 0 ? settings.monthlySalary / settings.monthlyHourDivisor : 0)}
          {' · '}günlük ücret {money(settings.monthlySalary / 30)} (aylık / 30). Fazla mesai ve
          eksik saat hesapları saatlik ücret üzerinden yapılır.
        </div>

        <div className="section-title">
          <h2 style={{ fontFamily: 'inherit', fontSize: 12 }}>Asgari ücretten hesapla</h2>
        </div>
        <div className="two">
          <NumInput
            label="Kaç asgari ücret"
            value={minWageCount}
            onChange={setMinWageCount}
            suffix="adet"
          />
          <NumInput
            label="Net asgari ücret"
            value={data.legal.minWageNet}
            onChange={() => undefined}
            suffix="₺"
            disabled
          />
        </div>
        <Button small variant="ghost" block onClick={applyMinimumWage} disabled={minWageCount <= 0}>
          Maaşı uygula (asgari ücret × adet ÷ 12)
        </Button>

        <TextField
          label="Diğer kesinti adı"
          value={settings.deductionName}
          onChange={(value) => updateSettings({ deductionName: value })}
        />
        <div className="two">
          <NumInput
            label="Sabit tutar"
            value={settings.deductionAmount}
            onChange={(value) => updateSettings({ deductionAmount: value })}
            suffix="₺"
          />
          <NumInput
            label="Maaştan yüzde"
            value={settings.deductionPercent}
            onChange={(value) => updateSettings({ deductionPercent: value })}
            suffix="%"
          />
        </div>
      </Card>

      )}

      {tab === 'gecmis' && (
      <Card title="Maaş geçmişi">
        <div className="note">
          Geçmiş ayların raporları, o ay geçerli olan maaş dönemiyle hesaplanır. Maaş
          ayarlarını değiştirdiğinizde yalnızca cari ay için yeni bir dönem oluşturulur; eski
          aylar bugünkü maaştan etkilenmez.
        </div>
        {[...data.salaryHistory]
          .sort((a, b) => b.from.localeCompare(a.from))
          .map((period) => (
            <div key={period.id} className="row">
              <span className="lbl">
                {periodLabel(period.from)}
                <span className="small muted">
                  {period.mode === 'hourly'
                    ? `Saatlik ${money(period.hourlyRate)} · bölen ${period.monthlyHourDivisor} sa`
                    : `${period.basis === 'gross' ? 'Brüt' : 'Net'} ${money(period.monthlySalary)}`}
                </span>
              </span>
              <span className="btn-row" style={{ margin: 0 }}>
                <button className="link-btn" onClick={() => startEditPeriod(period)}>
                  Düzenle
                </button>
                {data.salaryHistory.length > 1 && (
                  <button
                    className="link-btn danger"
                    onClick={() => {
                      removeSalaryPeriod(period.id);
                      notify('Maaş dönemi silindi.');
                    }}
                  >
                    Sil
                  </button>
                )}
              </span>
            </div>
          ))}
        {!data.salaryHistory.length && (
          <div className="muted">Henüz maaş dönemi yok; ilk mesai kaydıyla birlikte oluşur.</div>
        )}

        <div className="section-title">
          <h2 style={{ fontFamily: 'inherit', fontSize: 12 }}>
            {editingId ? 'Dönemi düzenle' : 'Yeni dönem'}
          </h2>
        </div>
        <TextField
          label="Geçerlilik başlangıcı"
          type="month"
          value={periodMonth}
          onChange={setPeriodMonth}
        />
        <label className="muted">Hesaplama yöntemi</label>
        <div style={{ marginTop: 6 }}>
          <Segmented
            value={periodMode}
            onChange={setPeriodMode}
            options={[
              { value: 'monthly', label: 'Aylık maaş' },
              { value: 'hourly', label: 'Saatlik ücret' },
            ]}
          />
        </div>
        <label className="muted" style={{ display: 'block', marginTop: 10 }}>
          Maaş türü
        </label>
        <div style={{ marginTop: 6 }}>
          <Segmented
            value={periodBasis}
            onChange={setPeriodBasis}
            options={[
              { value: 'net', label: 'Net' },
              { value: 'gross', label: 'Brüt' },
            ]}
          />
        </div>
        {periodMode === 'monthly' ? (
          <NumInput
            label="Aylık maaş"
            value={periodSalary}
            onChange={setPeriodSalary}
            suffix="₺"
          />
        ) : (
          <NumInput
            label="Saatlik ücret"
            value={periodHourly}
            onChange={setPeriodHourly}
            suffix="₺"
          />
        )}
        <NumInput
          label="Aylık saat böleni"
          value={periodDivisor}
          onChange={setPeriodDivisor}
          suffix="sa"
        />
        <div className="btn-row">
          <Button small variant="primary" onClick={applyPeriod}>
            {editingId ? 'Dönemi kaydet' : 'Dönem ekle'}
          </Button>
          {editingId && (
            <Button small variant="ghost" onClick={resetPeriodForm}>
              Vazgeç
            </Button>
          )}
        </div>
        <div className="note">
          Bir ayda kayıt yoksa o aydan önceki en yakın dönem geçerlidir. İlk dönem, ilk mesai
          veya izin kaydının ayına göre otomatik oluşturulur. Son dönem silinemez.
        </div>
      </Card>

      )}

      {tab === 'duzen' && (
      <Card title="Çalışma düzeni">
        <SelectField
          label="Haftalık çalışma günü"
          value={String(settings.weeklyWorkDays)}
          onChange={(value) => updateSettings({ weeklyWorkDays: Number(value) })}
          options={[
            { value: '5', label: '5 gün — Cumartesi, Pazar tatil' },
            { value: '6', label: '6 gün — Pazar tatil' },
            { value: '7', label: '7 gün — hafta tatili yok' },
            { value: '4', label: '4 gün — Cuma, Cmt, Pazar tatil' },
          ]}
        />
        <div className="two">
          <TextField
            label="İşe başlama"
            type="time"
            value={settings.workStart}
            onChange={(value) => updateSettings({ workStart: value })}
          />
          <TextField
            label="Bitiş"
            type="time"
            value={settings.workEnd}
            onChange={(value) => updateSettings({ workEnd: value })}
          />
        </div>
        <NumInput
          label="Mola süresi"
          value={settings.breakMinutes}
          onChange={(value) => updateSettings({ breakMinutes: value })}
          suffix="dk"
          integer
        />
        <Toggle
          label="Mola çalışma sayılsın"
          description="Kapalıysa giriş-çıkış süresinden mola düşülür."
          checked={settings.breakIncluded}
          onChange={(checked) => updateSettings({ breakIncluded: checked })}
        />
        <div className="note">
          {weekLabel(settings.weeklyWorkDays)} · {settings.workStart}–{settings.workEnd} ·{' '}
          {settings.breakIncluded ? 'mola dahil' : `${settings.breakMinutes} dk mola hariç`}
        </div>
      </Card>

      )}

      {tab === 'katsayi' && (
      <Card title="Mesai katsayıları">
        <NumInput
          label="Fazla mesai artışı"
          value={settings.overtimePercent}
          onChange={(value) => updateSettings({ overtimePercent: value })}
          suffix="%"
          hint="Örneğin %50 için 50 yazın; saatlik ücretin 1,5 katı uygulanır."
        />
        <div className="two">
          <NumInput
            label="Hafta sonu artışı"
            value={settings.weekendPercent}
            onChange={(value) => updateSettings({ weekendPercent: value })}
            suffix="%"
          />
          <NumInput
            label="Resmi tatil artışı"
            value={settings.holidayPercent}
            onChange={(value) => updateSettings({ holidayPercent: value })}
            suffix="%"
          />
        </div>
      </Card>

      )}

      {tab === 'izin' && (
      <Card title="İzin ayarları">
        <div className="two">
          <NumInput
            label="Yıllık izin hakkı"
            value={settings.annualLeaveEntitlement}
            onChange={(value) => updateSettings({ annualLeaveEntitlement: value })}
            suffix="gün"
          />
          <NumInput
            label="Devreden izin"
            value={settings.annualLeaveCarry}
            onChange={(value) => updateSettings({ annualLeaveCarry: value })}
            suffix="gün"
          />
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Maaştan kesilecek izin türleri
        </div>
        {LEAVE_TYPES.map((type) => (
          <Toggle
            key={type}
            label={LEAVE_META[type].label}
            description={
              settings.leaveDeductions[type]
                ? 'Maaştan kesilir (günlük ücret kadar)'
                : 'Ücretli — maaştan kesilmez'
            }
            checked={settings.leaveDeductions[type]}
            onChange={(checked) =>
              updateSettings({
                leaveDeductions: { ...settings.leaveDeductions, [type]: checked },
              })
            }
          />
        ))}
      </Card>

      )}

      {tab === 'vardiya' && (
      <Card title="Vardiyalar">
        {data.shifts.length ? (
          data.shifts.map((shift) => (
            <div key={shift.id} className="row">
              <span className="lbl">
                {shift.name}
                <span className="small muted">
                  {shift.start}–{shift.end}
                </span>
              </span>
              <button
                className="link-btn danger"
                onClick={() => {
                  removeShift(shift.id);
                  notify('Vardiya silindi.');
                }}
              >
                Sil
              </button>
            </div>
          ))
        ) : (
          <div className="muted">Henüz vardiya tanımlanmadı.</div>
        )}
        <TextField
          label="Vardiya adı"
          value={shiftName}
          onChange={setShiftName}
          placeholder="Örn. Gündüz"
        />
        <div className="two">
          <TextField label="Başlangıç" type="time" value={shiftStart} onChange={setShiftStart} />
          <TextField label="Bitiş" type="time" value={shiftEnd} onChange={setShiftEnd} />
        </div>
        <Button small variant="ghost" block onClick={addNewShift}>
          Vardiya ekle
        </Button>
        <div className="note">
          Vardiyalar gün kaydında seçilebilir; seçildiğinde giriş-çıkış saatleri otomatik dolar.
        </div>
      </Card>

      )}

      {tab === 'gorunum' && (
      <Card title="Görünüm">
        <div className="muted">Tema rengi</div>
        <div className="swatches">
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              className={`swatch ${data.theme.accent === accent.id ? 'on' : ''}`}
              onClick={() => updateTheme({ accent: accent.id })}
              aria-label={accent.label}
            >
              <i style={{ background: accent.color }} />
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Segmented
            value={data.theme.mode}
            onChange={(value) => updateTheme({ mode: value })}
            options={THEME_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
          />
        </div>
      </Card>

      )}

      {tab === 'hatirlatici' && (
      <Card title="Hatırlatıcılar">
        <Toggle
          label="Günlük mesai girişi"
          description="Bugün kayıt yoksa seçilen saatte hatırlatır."
          checked={data.reminders.overtime.enabled}
          onChange={(checked) => {
            updateReminders({
              overtime: { ...data.reminders.overtime, enabled: checked },
            });
            if (checked) void askPermission();
          }}
        />
        <TextField
          label="Mesai hatırlatma saati"
          type="time"
          value={data.reminders.overtime.time}
          onChange={(value) =>
            updateReminders({
              overtime: { ...data.reminders.overtime, time: value || '18:00' },
            })
          }
        />
        <Toggle
          label="İzin kaydı"
          description="O gün izin/rapor kaydı yoksa hatırlatır."
          checked={data.reminders.leave.enabled}
          onChange={(checked) => {
            updateReminders({ leave: { ...data.reminders.leave, enabled: checked } });
            if (checked) void askPermission();
          }}
        />
        <TextField
          label="İzin hatırlatma saati"
          type="time"
          value={data.reminders.leave.time}
          onChange={(value) =>
            updateReminders({
              leave: { ...data.reminders.leave, time: value || '09:00' },
            })
          }
        />
        <div className="btn-row">
          <Button small variant="ghost" onClick={() => void askPermission()}>
            Bildirim izni
          </Button>
          <Button small variant="ghost" onClick={() => void testNotification()}>
            Bildirimi dene
          </Button>
        </div>
        <div className="note">
          Bildirim durumu: <strong>{permission}</strong>.{' '}
          {Capacitor.isNativePlatform()
            ? 'Hatırlatıcılar cihazda planlanır ve uygulama kapalıyken de çalışır. Bildirim izni açık olmalı.'
            : 'Web sürümünde hatırlatıcılar uygulama açıkken çalışır; uygulama kapalıyken bildirim gönderilmez.'}
        </div>
      </Card>

      )}

      {tab === 'yedek' && (
      <Card title="Yedekleme">
        <Button variant="primary" block onClick={() => downloadBackup(data)}>
          JSON yedeği indir
        </Button>
        <label className="field" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--mut)' }}>Yedeği geri yükle (.json)</span>
          <input className="input" type="file" accept="application/json,.json" onChange={handleFile} />
        </label>
        <div className="note">
          Veriler tarayıcının yerel deposunda saklanır ve sayfa yenilendiğinde korunur. Yedek
          dosyası tüm profil, ayar, mesai, izin ve vardiya kayıtlarını içerir. Geri yükleme mevcut
          verilerin yerine geçer; önce yedek almanız önerilir.
        </div>
      </Card>

      )}

      {tab === 'hakkinda' && (
      <>
      <Card title="Hakkında">
        <div className="rows">
          <div className="row">
            <span className="lbl">Sürüm</span>
            <span className="val">4.0</span>
          </div>
          <div className="row">
            <span className="lbl">Kayıt sayısı</span>
            <span className="val">{Object.keys(data.entries).length} gün</span>
          </div>
          <div className="row">
            <span className="lbl">İzin kaydı</span>
            <span className="val">{data.leaves.length}</span>
          </div>
        </div>
        <Button small variant="ghost" block onClick={() => navigate('tools')}>
          Hesaplama araçları ve mevzuat parametreleri
        </Button>
      </Card>

      <Card>
        <Button
          variant="danger"
          block
          onClick={() => {
            if (
              window.confirm(
                'Tüm veriler silinsin mi? Profil, mesai, izin, vardiya ve ayarlar sıfırlanır. Bu işlem geri alınamaz; önce JSON yedeği almanız önerilir.',
              )
            ) {
              resetAll();
            }
          }}
        >
          Tüm verilerimi sil
        </Button>
      </Card>
      </>
      )}
    </>
  );
}
