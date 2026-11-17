import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { createDefaultData } from './defaults';
import { leaveOnDate } from './lib/calc';
import type {
  AppData,
  DayEntry,
  LeaveRecord,
  LegalParams,
  Profile,
  ReminderSettings,
  SalaryPeriod,
  Settings,
  Shift,
  ThemeSettings,
} from './types';
import {
  addDays,
  addMonths,
  daysInMonth,
  fromKey,
  monthKey,
  pad2,
  toKey,
} from './lib/date';
import { loadData, parseBackup, saveData } from './lib/storage';
import {
  ensureSalaryHistory,
  snapshotFromSettings,
  syncSettingsWithCurrentPeriod,
  upsertSalaryPeriod,
} from './lib/salary';

export type Screen = 'home' | 'calendar' | 'leaves' | 'reports' | 'settings' | 'tools';

export interface LeavePrefill {
  start: string;
  end: string;
}

export interface UiState {
  screen: Screen;
  view: { year: number; month: number };
  dayKey: string | null;
  leavePrefill: LeavePrefill | null;
}

export type LeaveInput = Omit<LeaveRecord, 'id' | 'createdAt'>;

interface AppContextValue {
  data: AppData;
  ui: UiState;
  toast: string;
  notify: (message: string) => void;
  navigate: (screen: Screen) => void;
  setView: (year: number, month: number) => void;
  stepMonth: (delta: number) => void;
  openDay: (key: string) => void;
  closeDay: () => void;
  openLeaveFor: (key: string) => void;
  clearLeavePrefill: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  saveSalaryPeriod: (period: SalaryPeriod) => void;
  removeSalaryPeriod: (id: string) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  updateLegal: (patch: Partial<LegalParams>) => void;
  updateTheme: (patch: Partial<ThemeSettings>) => void;
  updateReminders: (patch: Partial<ReminderSettings>) => void;
  setEntry: (key: string, entry: DayEntry | null) => void;
  addLeave: (input: LeaveInput) => string;
  updateLeave: (id: string, patch: Partial<LeaveInput>) => void;
  removeLeave: (id: string) => void;
  addShift: (input: Omit<Shift, 'id'>) => string;
  removeShift: (id: string) => void;
  clearMonth: (year: number, month: number) => void;
  importData: (text: string) => { ok: boolean; error?: string };
  resetAll: () => void;
  completeOnboarding: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useRef<ReturnType<typeof loadData> | null>(null);
  if (!initial.current) initial.current = loadData();
  const migrated = initial.current.migrated;

  const [data, setData] = useState<AppData>(() => ensureSalaryHistory(initial.current!.data));
  const [screen, setScreen] = useState<Screen>('home');
  const [view, setViewState] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [leavePrefill, setLeavePrefill] = useState<LeavePrefill | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (migrated) notify('Eski kayıtlarınız yeni sürüme aktarıldı.');
  }, [migrated, notify]);

  const update = useCallback((updater: (current: AppData) => AppData) => {
    setData(updater);
  }, []);

  const navigate = useCallback((next: Screen) => {
    setScreen(next);
    setDayKey(null);
    window.scrollTo({ top: 0 });
  }, []);

  const setView = useCallback((year: number, month: number) => {
    setViewState({ year, month });
  }, []);

  const stepMonth = useCallback((delta: number) => {
    setViewState((current) => addMonths(current.year, current.month, delta));
  }, []);

  const openDay = useCallback((key: string) => setDayKey(key), []);
  const closeDay = useCallback(() => setDayKey(null), []);

  const openLeaveFor = useCallback((key: string) => {
    const date = fromKey(key);
    setViewState({ year: date.getFullYear(), month: date.getMonth() });
    setLeavePrefill({ start: key, end: key });
    setDayKey(null);
    setScreen('leaves');
    window.scrollTo({ top: 0 });
  }, []);

  const clearLeavePrefill = useCallback(() => setLeavePrefill(null), []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((current) => {
        const settings = { ...current.settings, ...patch };
        const salaryChanged = (
          ['salaryMode', 'salaryBasis', 'monthlySalary', 'hourlyRate', 'monthlyHourDivisor'] as const
        ).some((field) => patch[field] !== undefined);
        if (!salaryChanged) return { ...current, settings };
        const now = new Date();
        const from = monthKey(now.getFullYear(), now.getMonth());
        const base = current.salaryHistory.length
          ? current.salaryHistory
          : ensureSalaryHistory(current).salaryHistory;
        return {
          ...current,
          settings,
          salaryHistory: upsertSalaryPeriod(base, snapshotFromSettings(settings, from)),
        };
      });
    },
    [update],
  );

  const saveSalaryPeriod = useCallback(
    (period: SalaryPeriod) => {
      update((current) =>
        syncSettingsWithCurrentPeriod({
          ...current,
          salaryHistory: upsertSalaryPeriod(current.salaryHistory, period),
        }),
      );
    },
    [update],
  );

  const removeSalaryPeriod = useCallback(
    (id: string) => {
      update((current) => {
        if (current.salaryHistory.length <= 1) return current;
        return syncSettingsWithCurrentPeriod({
          ...current,
          salaryHistory: current.salaryHistory.filter((period) => period.id !== id),
        });
      });
    },
    [update],
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      update((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
    },
    [update],
  );

  const updateLegal = useCallback(
    (patch: Partial<LegalParams>) => {
      update((current) => ({ ...current, legal: { ...current.legal, ...patch } }));
    },
    [update],
  );

  const updateTheme = useCallback(
    (patch: Partial<ThemeSettings>) => {
      update((current) => ({ ...current, theme: { ...current.theme, ...patch } }));
    },
    [update],
  );

  const updateReminders = useCallback(
    (patch: Partial<ReminderSettings>) => {
      update((current) => ({
        ...current,
        reminders: { ...current.reminders, ...patch },
      }));
    },
    [update],
  );

  const setEntry = useCallback(
    (key: string, entry: DayEntry | null) => {
      update((current) => {
        const entries = { ...current.entries };
        if (!entry || Object.keys(entry).length === 0) delete entries[key];
        else entries[key] = { ...entry, upd: new Date().toISOString() };
        return { ...current, entries };
      });
    },
    [update],
  );

  const addLeave = useCallback(
    (input: LeaveInput) => {
      const id = newId();
      const record: LeaveRecord = {
        ...input,
        id,
        createdAt: new Date().toISOString(),
      };
      update((current) => ({ ...current, leaves: [...current.leaves, record] }));
      return id;
    },
    [update],
  );

  const updateLeave = useCallback(
    (id: string, patch: Partial<LeaveInput>) => {
      update((current) => ({
        ...current,
        leaves: current.leaves.map((record) =>
          record.id === id ? { ...record, ...patch } : record,
        ),
      }));
    },
    [update],
  );

  const removeLeave = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        leaves: current.leaves.filter((record) => record.id !== id),
      }));
    },
    [update],
  );

  const addShift = useCallback(
    (input: Omit<Shift, 'id'>) => {
      const id = newId();
      update((current) => ({ ...current, shifts: [...current.shifts, { ...input, id }] }));
      return id;
    },
    [update],
  );

  const removeShift = useCallback(
    (id: string) => {
      update((current) => {
        const shifts = current.shifts.filter((shift) => shift.id !== id);
        const entries = Object.fromEntries(
          Object.entries(current.entries).map(([key, entry]) => [
            key,
            entry.shiftId === id ? { ...entry, shiftId: undefined } : entry,
          ]),
        );
        return { ...current, shifts, entries };
      });
    },
    [update],
  );

  const clearMonth = useCallback(
    (year: number, month: number) => {
      update((current) => {
        const prefix = monthKey(year, month);
        const first = `${prefix}-01`;
        const last = `${prefix}-${pad2(daysInMonth(year, month))}`;
        const entries = Object.fromEntries(
          Object.entries(current.entries).filter(([key]) => !(key >= first && key <= last)),
        );
        const leaves: LeaveRecord[] = [];
        for (const record of current.leaves) {
          if (record.end < first || record.start > last) {
            leaves.push(record);
            continue;
          }
          const startsBefore = record.start < first;
          const endsAfter = record.end > last;
          if (startsBefore) {
            leaves.push({
              ...record,
              id: `${record.id}_a`,
              end: toKey(addDays(fromKey(first), -1)),
            });
          }
          if (endsAfter) {
            leaves.push({
              ...record,
              id: `${record.id}_b`,
              start: toKey(addDays(fromKey(last), 1)),
            });
          }
        }
        return { ...current, entries, leaves };
      });
    },
    [update],
  );

  const importData = useCallback(
    (text: string) => {
      const parsed = parseBackup(text);
      if (!parsed) return { ok: false, error: 'Bu dosya geçerli bir Mesai Defteri yedeği değil.' };
      try {
        localStorage.setItem('mesai-defteri:previous', JSON.stringify(data));
      } catch {
        // Önceki veri yedeklenemedi; yine de içe aktarmaya devam et.
      }
      setData(ensureSalaryHistory(parsed));
      return { ok: true };
    },
    [data],
  );

  const resetAll = useCallback(() => {
    setData(ensureSalaryHistory(createDefaultData()));
    const now = new Date();
    setViewState({ year: now.getFullYear(), month: now.getMonth() });
    setScreen('home');
    setDayKey(null);
    setLeavePrefill(null);
  }, []);

  const completeOnboarding = useCallback(() => {
    update((current) => ({ ...current, onboardingDone: true }));
  }, [update]);

  const value: AppContextValue = {
    data,
    ui: { screen, view, dayKey, leavePrefill },
    toast,
    notify,
    navigate,
    setView,
    stepMonth,
    openDay,
    closeDay,
    openLeaveFor,
    clearLeavePrefill,
    updateSettings,
    saveSalaryPeriod,
    removeSalaryPeriod,
    updateProfile,
    updateLegal,
    updateTheme,
    updateReminders,
    setEntry,
    addLeave,
    updateLeave,
    removeLeave,
    addShift,
    removeShift,
    clearMonth,
    importData,
    resetAll,
    completeOnboarding,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp, AppProvider içinde kullanılmalıdır.');
  return context;
}

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationPermission(): PermissionState {
  if (Capacitor.isNativePlatform()) return 'default';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function getNotificationPermission(): Promise<PermissionState> {
  if (!Capacitor.isNativePlatform()) return notificationPermission();
  try {
    const status = await LocalNotifications.checkPermissions();
    return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      const status = current.display === 'granted' ? current : await LocalNotifications.requestPermissions();
      return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as PermissionState;
  } catch {
    return 'denied';
  }
}

export async function sendNotification(title: string, body: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') return false;
      await LocalNotifications.schedule({
        notifications: [{
          id: 1,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1200), allowWhileIdle: true },
          smallIcon: 'ic_stat_mesai',
        }],
      });
      return true;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const hasManifest = Boolean(document.querySelector('link[rel="manifest"]'));
    const options: NotificationOptions = {
      body,
      tag: 'mesai-defteri',
      ...(hasManifest ? { icon: './icon-192.png', badge: './icon-192.png' } : {}),
    };
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    // Bazı tarayıcılar (özellikle iOS) doğrudan Notification oluşturmayı desteklemez.
    return false;
  }
}

/** Keep the next month of native reminders scheduled so they still arrive when the app is closed. */
export async function syncNativeReminders(data: AppData): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;

    const pending = await LocalNotifications.getPending();
    const managed = pending.notifications.filter((item) => item.id >= 30_000_000 && item.id < 50_000_000);
    if (managed.length) await LocalNotifications.cancel({ notifications: managed.map(({ id }) => ({ id })) });

    const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
    const now = new Date();
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const key = toKey(date);
      const hasEntry = Boolean(data.entries[key]);
      const leaveExists = Boolean(leaveOnDate(data, key));
      const reminders = [
        {
          kind: 0,
          setting: data.reminders.overtime,
          due: !hasEntry,
          title: 'Mesai Defteri',
          body: 'Bugünkü mesai kaydını girmeyi unutma.',
        },
        {
          kind: 1,
          setting: data.reminders.leave,
          due: !hasEntry && !leaveExists,
          title: 'Mesai Defteri',
          body: 'İzin veya rapor kaydın varsa girmeyi unutma.',
        },
      ];
      for (const reminder of reminders) {
        if (!reminder.setting.enabled || !reminder.due) continue;
        const [hours, minutes] = reminder.setting.time.split(':').map(Number);
        const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
        if (at <= now) continue;
        const dayNumber = Number(key.replaceAll('-', ''));
        notifications.push({
          id: 1_000 + dayNumber * 2 + reminder.kind,
          title: reminder.title,
          body: reminder.body,
          smallIcon: 'ic_stat_mesai',
          schedule: { at, allowWhileIdle: true },
        });
      }
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch {
    // Reminder sync should never prevent the rest of the app from opening.
  }
}
