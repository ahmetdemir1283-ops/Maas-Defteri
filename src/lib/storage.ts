import { LEGACY_KEY, STORAGE_KEY } from '../defaults';
import type { AppData } from '../types';
import { todayKey } from './date';
import { normalizeData } from './migrate';

export interface LoadResult {
  data: AppData;
  migrated: boolean;
}

export function loadData(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { data: normalizeData(JSON.parse(raw)), migrated: false };
  } catch {
    // Bozuk kayıt: eski veriye veya varsayılana düş.
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = normalizeData(JSON.parse(legacy));
      data.onboardingDone = true;
      return { data, migrated: true };
    }
  } catch {
    // Eski kayıt okunamadıysa yeni kurulumla devam et.
  }
  return { data: normalizeData(null), migrated: false };
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Depolama dolu/kapalı olabilir; uygulama oturum boyunca çalışmaya devam eder.
  }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(
    {
      app: 'mesai-defteri',
      version: 4,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}

export function parseBackup(text: string): AppData | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate =
      parsed.data && typeof parsed.data === 'object'
        ? (parsed.data as Record<string, unknown>)
        : parsed;
    const recognizable =
      'settings' in candidate ||
      's' in candidate ||
      'entries' in candidate ||
      'e' in candidate ||
      'leaves' in candidate ||
      'l' in candidate;
    if (!recognizable) return null;
    return normalizeData(parsed);
  } catch {
    return null;
  }
}

export function downloadBackup(data: AppData): void {
  const blob = new Blob([exportJson(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mesai-defteri-yedek-${todayKey()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Eski sürümün verisini silmeden yeni anahtara taşındığını işaretler. */
export function markMigrated(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.version = 4;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Sessizce geç: veri zaten yeni anahtarda.
  }
}
