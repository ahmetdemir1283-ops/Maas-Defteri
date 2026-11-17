import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { leaveOnDate, overtimePay, timespanMinutes } from '../lib/calc';
import { duration, money } from '../lib/format';
import { fullDateLabel, isRestDay, fromKey } from '../lib/date';
import { LEAVE_META } from '../defaults';
import {
  Button,
  Field,
  NumInput,
  Row,
  SelectField,
  Sheet,
  TextField,
  Toggle,
} from '../components/ui';
import type { DayEntry } from '../types';

export default function DaySheet() {
  const { data, ui, closeDay, setEntry, notify, openLeaveFor, navigate } = useApp();
  const key = ui.dayKey;
  if (!key) return null;

  const date = fromKey(key);
  const existing = data.entries[key];
  const leave = leaveOnDate(data, key);
  const isRest = isRestDay(date, data.settings.weeklyWorkDays);
  const shift = data.shifts.find((item) => item.id === existing?.shiftId);

  const [ot, setOt] = useState(existing?.ot ?? 0);
  const [df, setDf] = useState(existing?.df ?? 0);
  const [absent, setAbsent] = useState(Boolean(existing?.ab));
  const [holiday, setHoliday] = useState(Boolean(existing?.rt));
  const [start, setStart] = useState(existing?.gi ?? '');
  const [end, setEnd] = useState(existing?.ci ?? '');
  const [shiftId, setShiftId] = useState(existing?.shiftId ?? '');
  const [note, setNote] = useState(existing?.n ?? '');

  const kind = holiday ? 'holiday' : isRest ? 'weekend' : 'normal';
  const earnings = useMemo(
    () => overtimePay(data.settings, ot, kind),
    [data.settings, ot, kind],
  );

  const selectedShift = data.shifts.find((item) => item.id === shiftId);

  const calculateFromTimes = () => {
    const span = timespanMinutes(start, end);
    if (span == null) {
      notify('Önce giriş ve çıkış saatlerini girin.');
      return;
    }
    const pause = data.settings.breakIncluded ? 0 : Math.max(0, data.settings.breakMinutes);
    const worked = Math.max(0, span - pause);
    const shiftSpan = selectedShift
      ? timespanMinutes(selectedShift.start, selectedShift.end)
      : null;
    const target = Math.max(
      0,
      (shiftSpan ?? Math.round(data.settings.dailyHours * 60)) -
        (data.settings.breakIncluded ? 0 : Math.max(0, data.settings.breakMinutes)),
    );
    const diff = worked - target;
    if (diff > 0) {
      setOt(diff);
      setDf(0);
      notify(`Ek mesai ${duration(diff)} olarak hesaplandı.`);
    } else if (diff < 0) {
      setOt(0);
      setDf(-diff);
      notify(`Eksik süre ${duration(-diff)} olarak hesaplandı.`);
    } else {
      setOt(0);
      setDf(0);
      notify('Süre normal çalışma saatine eşit.');
    }
  };

  const save = () => {
    const out: DayEntry = {};
    if (absent) {
      out.ab = 1;
    } else {
      if (ot > 0) out.ot = Math.round(ot);
      if (df > 0) out.df = Math.round(df);
      if (start && end) {
        out.gi = start;
        out.ci = end;
      }
    }
    if (holiday) out.rt = 1;
    if (shiftId) out.shiftId = shiftId;
    const trimmed = note.trim();
    if (trimmed) out.n = trimmed;

    setEntry(key, Object.keys(out).length ? out : null);
    notify('Gün kaydedildi.');
    closeDay();
  };

  const clear = () => {
    setEntry(key, null);
    notify('Günün kaydı temizlendi.');
    closeDay();
  };

  return (
    <Sheet
      title={fullDateLabel(key)}
      subtitle={
        leave
          ? `${LEAVE_META[leave.type].label}${leave.minutesPerDay ? ` · ${duration(leave.minutesPerDay)}` : ''}`
          : isRest
            ? 'Hafta tatili'
            : 'Mesai ve çalışma kaydı'
      }
      onClose={closeDay}
      footer={
        <>
          <Button variant="primary" onClick={save}>
            Kaydet
          </Button>
          <Button variant="ghost" onClick={clear}>
            Temizle
          </Button>
        </>
      }
    >
      {leave && (
        <div className="note ok" style={{ marginTop: 0 }}>
          Bu gün <strong>{LEAVE_META[leave.type].label.toLowerCase()}</strong> olarak işaretli.
          {leave.record.note ? ` Not: ${leave.record.note}` : ''}
          <div style={{ marginTop: 8 }}>
            <Button small variant="ghost" onClick={() => navigate('leaves')}>
              İzin kaydını yönet
            </Button>
          </div>
        </div>
      )}

      <div className="rows" style={{ marginTop: 4 }}>
        <Toggle
          label="Resmi tatil"
          description="Resmi tatilde çalışılan süre tatil katsayısıyla hesaplanır."
          checked={holiday}
          onChange={(checked) => {
            setHoliday(checked);
            if (checked) setAbsent(false);
          }}
        />
        <Toggle
          label="Gelmedi"
          description="Gelmediği günlerde günlük ücret kadar kesinti uygulanır."
          checked={absent}
          onChange={(checked) => {
            setAbsent(checked);
            if (checked) {
              setHoliday(false);
              setOt(0);
              setDf(0);
            }
          }}
        />
      </div>

      {!absent && (
        <>
          <Field
            label="Fazla mesai"
            hint={`Toplam ${duration(ot)} · ${money(earnings)}`}
          >
            <div className="two">
              <NumInput
                label="Saat"
                integer
                value={Math.floor(ot / 60)}
                onChange={(hours) => setOt(hours * 60 + (ot % 60))}
              />
              <NumInput
                label="Dakika"
                integer
                max={59}
                value={ot % 60}
                onChange={(minutes) => setOt(Math.floor(ot / 60) * 60 + minutes)}
              />
            </div>
            <div className="btn-row" style={{ marginTop: 2 }}>
              {[30, 60, 120, 180].map((minutes) => (
                <Button
                  key={minutes}
                  small
                  variant="ghost"
                  onClick={() => setOt((value) => value + minutes)}
                >
                  +{minutes < 60 ? `${minutes} dk` : `${minutes / 60} sa`}
                </Button>
              ))}
              {ot > 0 && (
                <Button small variant="ghost" onClick={() => setOt(0)}>
                  Sıfırla
                </Button>
              )}
            </div>
          </Field>

          <Field label="Eksik saat" hint={`Toplam ${duration(df)}`}>
            <div className="two">
              <NumInput
                label="Saat"
                integer
                value={Math.floor(df / 60)}
                onChange={(hours) => setDf(hours * 60 + (df % 60))}
              />
              <NumInput
                label="Dakika"
                integer
                max={59}
                value={df % 60}
                onChange={(minutes) => setDf(Math.floor(df / 60) * 60 + minutes)}
              />
            </div>
          </Field>

          <div className="two">
            <TextField label="Giriş" type="time" value={start} onChange={setStart} />
            <TextField label="Çıkış" type="time" value={end} onChange={setEnd} />
          </div>
          <Button variant="ghost" block small onClick={calculateFromTimes}>
            Süreyi giriş-çıkıştan hesapla
          </Button>

          {data.shifts.length > 0 && (
            <SelectField
              label="Vardiya"
              value={shiftId}
              onChange={(value) => {
                setShiftId(value);
                const found = data.shifts.find((item) => item.id === value);
                if (found && !start && !end) {
                  setStart(found.start);
                  setEnd(found.end);
                }
              }}
              options={[
                { value: '', label: 'Vardiya seçilmedi' },
                ...data.shifts.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.start}–${item.end})`,
                })),
              ]}
            />
          )}
          {shift && (
            <div className="note">Seçili vardiya: {shift.name} · {shift.start}–{shift.end}</div>
          )}
        </>
      )}

      <Field label="Not">
        <textarea
          className="input"
          value={note}
          placeholder="Örn. depo sayımı, nöbet devri…"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      {ot > 0 && !absent && (
        <div className="rows" style={{ marginTop: 6 }}>
          <Row
            label={`Mesai kazancı (${kind === 'holiday' ? 'resmi tatil' : kind === 'weekend' ? 'hafta sonu' : 'normal'})`}
            value={money(earnings)}
            tone="pos"
          />
        </div>
      )}

      <Button
        variant="ghost"
        block
        small
        onClick={() => openLeaveFor(key)}
        className="no-print"
      >
        Bu güne izin ekle
      </Button>
    </Sheet>
  );
}
