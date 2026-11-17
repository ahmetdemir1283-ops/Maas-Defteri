import { useState } from 'react';
import { useApp } from '../store';
import { duration, money } from '../lib/format';
import { weekLabel } from '../lib/labels';
import {
  Button,
  NumInput,
  Segmented,
  SelectField,
  TextField,
  Toggle,
} from '../components/ui';

export default function Onboarding() {
  const { data, updateSettings, updateProfile, completeOnboarding, notify } = useApp();
  const [step, setStep] = useState(0);
  const settings = data.settings;

  const finish = () => {
    if (
      settings.salaryMode === 'monthly' &&
      settings.monthlySalary <= 0 &&
      settings.hourlyRate <= 0
    ) {
      notify('Maaş bilgisini daha sonra Ayarlar’dan ekleyebilirsin.');
    }
    completeOnboarding();
  };

  return (
    <div className="onboard">
      <div className="steps">Adım {step + 1} / 3</div>
      <h1>{['Seni tanıyalım', 'Maaş ve mesai', 'Çalışma düzeni'][step]}</h1>
      <div className="body">
        {step === 0 && (
          <div className="card">
            <div className="muted">Bu bilgiler yalnızca bu cihazda saklanır.</div>
            <TextField
              label="Adın"
              value={data.profile.name}
              onChange={(value) => updateProfile({ name: value })}
              placeholder="Ad Soyad"
            />
            <TextField
              label="İş yeri"
              value={data.profile.workplace}
              onChange={(value) => updateProfile({ workplace: value })}
              placeholder="Firma adı"
            />
            <TextField
              label="Pozisyon"
              value={data.profile.position}
              onChange={(value) => updateProfile({ position: value })}
              placeholder="Görev"
            />
            <TextField
              label="İşe başlama tarihi (isteğe bağlı)"
              type="date"
              value={data.profile.startDate}
              onChange={(value) => updateProfile({ startDate: value })}
              hint="Tazminat araçlarında varsayılan tarih olarak kullanılır."
            />
          </div>
        )}

        {step === 1 && (
          <div className="card">
            <label className="muted">Hesaplama yöntemi</label>
            <div style={{ marginTop: 6 }}>
              <Segmented
                value={settings.salaryMode}
                onChange={(value) => updateSettings({ salaryMode: value })}
                options={[
                  { value: 'monthly', label: 'Aylık maaş' },
                  { value: 'hourly', label: 'Saatlik ücret' },
                ]}
              />
            </div>
            <label className="muted" style={{ display: 'block', marginTop: 12 }}>
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
                placeholder="0"
              />
            ) : (
              <NumInput
                label="Saatlik ücret"
                value={settings.hourlyRate}
                onChange={(value) => updateSettings({ hourlyRate: value })}
                suffix="₺"
                placeholder="0"
              />
            )}

            <div className="two">
              <NumInput
                label="Günlük net çalışma saati"
                value={settings.dailyHours}
                onChange={(value) => updateSettings({ dailyHours: value })}
                suffix="sa"
              />
              <NumInput
                label="Aylık saat böleni"
                value={settings.monthlyHourDivisor}
                onChange={(value) => updateSettings({ monthlyHourDivisor: value })}
                suffix="sa"
                hint="Genelde 225 (30 × 7,5)."
              />
            </div>

            <div className="two">
              <NumInput
                label="Fazla mesai artışı"
                value={settings.overtimePercent}
                onChange={(value) => updateSettings({ overtimePercent: value })}
                suffix="%"
              />
              <NumInput
                label="Hafta sonu artışı"
                value={settings.weekendPercent}
                onChange={(value) => updateSettings({ weekendPercent: value })}
                suffix="%"
              />
            </div>
            <NumInput
              label="Resmi tatil mesai artışı"
              value={settings.holidayPercent}
              onChange={(value) => updateSettings({ holidayPercent: value })}
              suffix="%"
            />
            <div className="note">
              Saatlik ücret = aylık ücret ÷ {settings.monthlyHourDivisor}. Değerleri daha sonra
              Ayarlar’dan değiştirebilirsin.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card">
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
            <div className="two">
              <NumInput
                label="Mola"
                value={settings.breakMinutes}
                onChange={(value) => updateSettings({ breakMinutes: value })}
                suffix="dk"
                integer
              />
              <NumInput
                label="Yıllık izin hakkı"
                value={settings.annualLeaveEntitlement}
                onChange={(value) => updateSettings({ annualLeaveEntitlement: value })}
                suffix="gün"
                integer
              />
            </div>
            <Toggle
              label="Mola çalışma sayılsın"
              description="Kapalıysa giriş-çıkış süresinden mola düşülür."
              checked={settings.breakIncluded}
              onChange={(checked) => updateSettings({ breakIncluded: checked })}
            />
            <div className="two">
              <NumInput
                label="Diğer kesinti (tutar)"
                value={settings.deductionAmount}
                onChange={(value) => updateSettings({ deductionAmount: value })}
                suffix="₺"
              />
              <NumInput
                label="Diğer kesinti"
                value={settings.deductionPercent}
                onChange={(value) => updateSettings({ deductionPercent: value })}
                suffix="%"
              />
            </div>
            <div className="note">
              Günlük {duration(settings.dailyHours * 60)} · {weekLabel(settings.weeklyWorkDays)} ·
              {settings.breakIncluded ? ' mola dahil' : ` ${settings.breakMinutes} dk mola hariç`}.
              {settings.monthlySalary > 0
                ? ` Aylık ${money(settings.monthlySalary)}.`
                : ''}
            </div>
          </div>
        )}
      </div>

      <div className="foot">
        <Button
          variant="primary"
          block
          onClick={() => (step < 2 ? setStep((value) => value + 1) : finish())}
        >
          {step < 2 ? 'Devam' : 'Başla'}
        </Button>
        {step > 0 && (
          <Button variant="ghost" block onClick={() => setStep((value) => value - 1)}>
            Geri
          </Button>
        )}
        <button className="link-btn" onClick={finish} style={{ padding: 8 }}>
          Şimdilik geç
        </button>
      </div>
    </div>
  );
}
