import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { sendNotification, syncNativeReminders, useApp } from './store';
import type { Screen } from './store';
import { Icon } from './components/ui';
import type { IconName } from './components/ui';
import Home from './screens/Home';
import CalendarScreen from './screens/CalendarScreen';
import LeavesScreen from './screens/LeavesScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ToolsScreen from './screens/ToolsScreen';
import DaySheet from './screens/DaySheet';
import Onboarding from './screens/Onboarding';
import { leaveOnDate } from './lib/calc';
import { pad2, toKey } from './lib/date';
import type { AppData, ReminderSettings, ThemeSettings } from './types';

const NAV: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: 'home', label: 'Anasayfa', icon: 'home' },
  { screen: 'calendar', label: 'Takvim', icon: 'calendar' },
  { screen: 'leaves', label: 'İzin', icon: 'leaf' },
  { screen: 'reports', label: 'Rapor', icon: 'chart' },
  { screen: 'settings', label: 'Ayarlar', icon: 'settings' },
];

export default function App() {
  const { data, ui, navigate, toast, notify, updateReminders } = useApp();

  useThemeEffect(data.theme);
  useReminders(data, notify, updateReminders);
  useEffect(() => {
    void syncNativeReminders(data);
  }, [data]);

  if (!data.onboardingDone) {
    return (
      <>
        <Onboarding />
        <div className={`toast ${toast ? 'show' : ''}`} aria-live="polite">
          {toast}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="app">
        {ui.screen === 'home' && <Home />}
        {ui.screen === 'calendar' && <CalendarScreen />}
        {ui.screen === 'leaves' && <LeavesScreen />}
        {ui.screen === 'reports' && <ReportsScreen />}
        {ui.screen === 'settings' && <SettingsScreen />}
        {ui.screen === 'tools' && <ToolsScreen />}

        <nav className="nav no-print" aria-label="Ana menü">
          {NAV.map((item) => (
            <button
              key={item.screen}
              className={ui.screen === item.screen ? 'on' : ''}
              onClick={() => navigate(item.screen)}
              aria-current={ui.screen === item.screen ? 'page' : undefined}
            >
              <Icon name={item.icon} size={21} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {ui.dayKey && <DaySheet key={ui.dayKey} />}

      <div className={`toast ${toast ? 'show' : ''}`} aria-live="polite">
        {toast}
      </div>
    </>
  );
}

function useThemeEffect(theme: ThemeSettings) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const mode = theme.mode === 'auto' ? (media.matches ? 'dark' : 'light') : theme.mode;
      document.documentElement.setAttribute('data-mode', mode);
      document.documentElement.setAttribute('data-accent', theme.accent);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', mode === 'dark' ? '#0b0b0c' : '#f4f1ea');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme.mode, theme.accent]);
}

function useReminders(
  data: AppData,
  notify: (message: string) => void,
  updateReminders: (patch: Partial<ReminderSettings>) => void,
) {
  const dataRef = useRef(data);
  dataRef.current = data;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const updateRef = useRef(updateReminders);
  updateRef.current = updateReminders;

  useEffect(() => {
    const check = () => {
      if (Capacitor.isNativePlatform()) return;
      const current = dataRef.current;
      if (!current.onboardingDone) return;
      const now = new Date();
      const today = toKey(now);
      const clock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      const fired: Record<string, string> = {};
      const fire = (key: string, enabled: boolean, time: string, due: boolean, message: string) => {
        if (!enabled || !due) return;
        if (clock < time) return;
        if (current.reminders.lastFired[key] === today) return;
        fired[key] = today;
        notifyRef.current(message);
        void sendNotification('Mesai Defteri', message);
      };

      const hasEntry = Boolean(current.entries[today]);
      fire(
        'overtime',
        current.reminders.overtime.enabled,
        current.reminders.overtime.time,
        !hasEntry,
        'Bugünkü mesai kaydını girmeyi unutma.',
      );
      fire(
        'leave',
        current.reminders.leave.enabled,
        current.reminders.leave.time,
        !hasEntry && !leaveOnDate(current, today),
        'İzin veya rapor kaydın varsa girmeyi unutma.',
      );

      if (Object.keys(fired).length) {
        updateRef.current({ lastFired: { ...current.reminders.lastFired, ...fired } });
      }
    };

    check();
    const interval = window.setInterval(check, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
