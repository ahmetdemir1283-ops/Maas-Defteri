import { useEffect, useId, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { addMonths, MONTHS, WEEKDAYS_SHORT } from '../lib/date';
import { numberText, parseNumberText, shortDuration } from '../lib/format';
import { DAY_STATUS_META, LEAVE_META } from '../defaults';
import type { DayStatus, Shift } from '../types';
import type { DayInfo } from '../lib/calc';

export const ICONS = {
  home: 'M4 11.2 12 4l8 7.2M6.5 10v9.5h11V10',
  calendar:
    'M7 3v3M17 3v3M4 8.5h16M5.5 5.5h13A1.5 1.5 0 0 1 20 7v12.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5V7a1.5 1.5 0 0 1 1.5-1.5Z',
  chart: 'M5 20V11M12 20V4M19 20v-6',
  settings:
    'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  calc: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0',
  plus: 'M12 5v14M5 12h14',
  trash:
    'M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5A1.5 1.5 0 0 0 8.8 21h6.4a1.5 1.5 0 0 0 1.5-1.5L17.5 7M10 11v6M14 11v6',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  share: 'M12 16V4M8 8l4-4 4 4M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  download: 'M12 4v12M8 12l4 4 4-4M5 20h14',
  upload: 'M12 20V8M8 12l4-4 4 4M5 4h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  wallet: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9ZM4 8h15M15 12.5h2',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5v.5',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4',
  leaf: 'M20 4S9 4 6 11c-2 4.5 1 8 1 8s4 2 8-1c7-4 5-14 5-14ZM4 21c2-6 6-9 10-11',
  briefcase: 'M4 8h16v11H4V8ZM9 8V5h6v3M4 12.5h16',
  tool: 'M14.5 6.5a3.5 3.5 0 1 0-4.6 4.6L4 17v3h3l5.9-5.9a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2.5-2.5 2.8-2.8Z',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function PageTop({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="page-top">
      {onBack && (
        <button className="back no-print" onClick={onBack} aria-label="Geri">
          <Icon name="chevronLeft" size={20} />
        </button>
      )}
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {typeof title === 'string' ? <b>{title}</b> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Row({
  label,
  value,
  sub,
  total,
  tone,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  total?: boolean;
  tone?: 'pos' | 'neg' | 'warn' | 'mut';
  strong?: boolean;
}) {
  return (
    <div className={`row ${total ? 'total' : ''} ${sub ? 'sub' : ''}`}>
      <span className="lbl">
        {label}
        {sub && <span className="small muted">{sub}</span>}
      </span>
      <span className={`val ${tone ?? ''}`} style={strong ? { fontWeight: 600 } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function Stat({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  tone?: 'pos' | 'neg' | 'warn';
}) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <b className={tone ?? ''}>{value}</b>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'plain',
  block,
  small,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'plain' | 'primary' | 'accent' | 'ghost' | 'danger';
  block?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`btn ${variant !== 'plain' ? variant : ''} ${block ? 'block' : ''} ${
        small ? 'sm' : ''
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  min,
  max,
  step,
  autoFocus,
  inputMode,
  disabled,
}: {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: ReactNode;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  autoFocus?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email' | 'tel' | 'url' | 'search';
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        autoFocus={autoFocus}
        inputMode={inputMode}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function NumInput({
  label,
  value,
  onChange,
  hint,
  suffix,
  min = 0,
  max,
  integer,
  placeholder,
  disabled,
}: {
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
  suffix?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => numberText(value));

  useEffect(() => {
    if (!focused) setText(numberText(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    let next = parseNumberText(raw);
    if (integer) next = Math.round(next);
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(next);
    setText(numberText(next));
  };

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="input-wrap">
        <input
          id={id}
          className="input"
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={(event) => {
            setFocused(true);
            if (value === 0) setText('');
            else event.currentTarget.select();
          }}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            if (!raw.trim()) {
              onChange(0);
              return;
            }
            let next = parseNumberText(raw);
            if (integer) next = Math.round(next);
            if (min != null) next = Math.max(min, next);
            if (max != null) next = Math.min(max, next);
            onChange(next);
          }}
          onBlur={() => {
            setFocused(false);
            commit(text);
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="txt">
        <span>{label}</span>
        {description && <span className="sub">{description}</span>}
      </span>
      <span className={`switch ${checked ? 'on' : ''}`} />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'on' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="pill-row tabbar no-print" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`pill ${value === option.value ? 'on' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="muted" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

export function MonthNav({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
}) {
  return (
    <div className="month-nav">
      <div className="label">{MONTHS[month]} {year}</div>
      <div className="arrows">
        {onToday && (
          <button className="link-btn" onClick={onToday} style={{ marginRight: 2 }}>
            Bugün
          </button>
        )}
        <button className="icon-btn" onClick={onPrev} aria-label="Önceki ay">
          <Icon name="chevronLeft" size={17} />
        </button>
        <button className="icon-btn" onClick={onNext} aria-label="Sonraki ay">
          <Icon name="chevronRight" size={17} />
        </button>
      </div>
    </div>
  );
}

export function YearNav({
  year,
  onPrev,
  onNext,
}: {
  year: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="month-nav">
      <div className="label">{year}</div>
      <div className="arrows">
        <button className="icon-btn" onClick={onPrev} aria-label="Önceki yıl">
          <Icon name="chevronLeft" size={17} />
        </button>
        <button className="icon-btn" onClick={onNext} aria-label="Sonraki yıl">
          <Icon name="chevronRight" size={17} />
        </button>
      </div>
    </div>
  );
}

export function CalendarGrid({
  days,
  year,
  month,
  onSelect,
  shifts = [],
}: {
  days: DayInfo[];
  year: number;
  month: number;
  onSelect: (key: string) => void;
  shifts?: Shift[];
}) {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const blanks = Array.from({ length: leading }, (_, index) => (
    <span key={`blank_${index}`} />
  ));

  return (
    <div className="cal" role="grid" aria-label={`${MONTHS[month]} ${year} takvimi`}>
      {WEEKDAYS_SHORT.map((label) => (
        <div className="cal-head" key={label}>
          {label}
        </div>
      ))}
      {blanks}
      {days.map((day) => {
        const color = statusColor(day.status);
        const tint = statusTint(day.status, color);
        const label = dayLabel(day);
        const dots: string[] = [];
        const shift = day.shiftId ? shifts.find((item) => item.id === day.shiftId) : undefined;
        if (day.otMinutes > 0) dots.push('#2f9e6a');
        if (day.entry?.ab) dots.push('#b4232c');
        if (day.entry?.rt) dots.push('#d98324');
        if (day.leave) dots.push(LEAVE_META[day.leave.type].color);
        if (shift) dots.push('#8e5cf7');
        if (day.entry?.n) dots.push('var(--mut)');
        const tag = shortLabel(day, shift?.name);
        return (
          <button
            key={day.key}
            type="button"
            className={`day ${day.isRest ? 'rest' : ''} ${day.isToday ? 'today' : ''}`}
            style={tint ? { background: tint } : undefined}
            onClick={() => onSelect(day.key)}
            aria-label={`${day.day} ${MONTHS[month]} ${year}, ${label}${shift ? `, ${shift.name}` : ''}`}
            title={`${day.day} ${MONTHS[month]} — ${label}${shift ? ` · ${shift.name}` : ''}`}
          >
            <span className="day-num">{day.day}</span>
            {tag && <span className="day-tag" style={color ? { color } : undefined}>{tag}</span>}
            {dots.length > 0 && (
              <span className="dots">
                {dots.slice(0, 4).map((dot, index) => (
                  <i key={index} style={{ background: dot }} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function statusColor(status: DayStatus): string | null {
  if (status in LEAVE_META) return LEAVE_META[status as keyof typeof LEAVE_META].color;
  return DAY_STATUS_META[status]?.color ?? null;
}

export function statusTint(status: DayStatus, color: string | null): string | undefined {
  if (!color) return undefined;
  if (status === 'hafta-tatili' || status === 'bos') return undefined;
  const weight = status === 'yillik' || status === 'ucretsiz' ? 20 : 16;
  return `color-mix(in srgb, ${color} ${weight}%, transparent)`;
}

export function dayLabel(day: DayInfo): string {
  if (day.leave) return LEAVE_META[day.leave.type].label;
  if (day.status === 'tatil') return 'Resmi tatil';
  if (day.status === 'yok') return 'Gelmedi';
  if (day.status === 'mesai') return 'Fazla mesai';
  if (day.status === 'calisma') return 'Normal çalışma';
  if (day.status === 'hafta-tatili') return 'Hafta tatili';
  return 'Kayıt yok';
}

function shortLabel(day: DayInfo, shiftName?: string): string {
  if (day.leave) return LEAVE_META[day.leave.type].short;
  if (day.status === 'tatil') return 'Tatil';
  if (day.status === 'yok') return 'Yok';
  if (day.otMinutes > 0) return `+${shortDuration(day.otMinutes)}`;
  if (day.workedMinutes != null && day.workedMinutes > 0) return shortDuration(day.workedMinutes);
  if (shiftName) return shiftName.slice(0, 6);
  return '';
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  return addMonths(year, month, 1);
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  return addMonths(year, month, -1);
}
