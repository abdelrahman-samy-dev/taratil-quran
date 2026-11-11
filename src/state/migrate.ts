/**
 * One-time migration from Taratil v3 (plain localStorage keys) to v4.
 * Must be imported before any module that reads persisted state.
 */
import { read, readRaw, write } from '../lib/storage';

const DONE = 'migrated:v3';

function legacy<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    const raw = localStorage.getItem(key);
    return (raw as unknown as T) ?? fallback;
  }
}

function migrate() {
  if (typeof localStorage === 'undefined' || readRaw(DONE)) return;
  const has = (k: string) => localStorage.getItem(k) != null;
  const anyLegacy = ['prefs_theme', 'mushaf_last_page', 'mushaf_bookmarks', 'gami_data', 'usage'].some(has);
  if (!anyLegacy) {
    write(DONE, Date.now());
    return;
  }

  // Preferences
  const prefs = read<Record<string, unknown>>('prefs', {});
  const theme = localStorage.getItem('prefs_theme');
  if (theme === 'light' || theme === 'dark' || theme === 'amoled') prefs.theme = theme;
  const shape = localStorage.getItem('prefs_shape');
  if (shape) prefs.shape = shape.replace('shape-', '');
  const fs = Number.parseFloat(localStorage.getItem('prefs_fontScale') || '');
  if (fs >= 0.8 && fs <= 1.5) prefs.fontScale = Math.min(1.3, fs);
  if (has('prefs_autoplay')) prefs.autoplay = localStorage.getItem('prefs_autoplay') !== 'false';
  if (has('prefs_haptics')) prefs.haptics = localStorage.getItem('prefs_haptics') !== 'false';
  const night = Number.parseFloat(localStorage.getItem('mushaf_night') || '');
  if (night > 0) prefs.mushafDim = Math.min(0.6, night);
  const surah = Number.parseInt(localStorage.getItem('continue_reading_surah') || '', 10);
  write('prefs', prefs);
  if (surah >= 1 && surah <= 114) write('tafsir:last', surah);

  // Reading position & bookmarks
  const lastPage = Number.parseInt(localStorage.getItem('mushaf_last_page') || '', 10);
  if (lastPage >= 1 && lastPage <= 604) write('lastRead', { page: lastPage, at: Date.now() });
  const oldMarks = legacy<{ page: number; label?: string }[]>('mushaf_bookmarks', []);
  if (Array.isArray(oldMarks) && oldMarks.length) {
    write(
      'bookmarks',
      oldMarks
        .filter((b) => b && b.page >= 1 && b.page <= 604)
        .map((b, i) => ({ id: `m${Date.now()}${i}`, page: b.page, label: b.label || 'عام', at: Date.now() - i })),
    );
  }

  // Werd goal + per-day pages
  const goal = Number.parseInt(localStorage.getItem('mushaf_werd_goal') || '', 10);
  write('werd', { goal: goal > 0 ? goal : 10, plan: null });
  const log: Record<string, { pages: number[]; azkar: string[]; listen: number }> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || '';
    const m = /^mushaf_werd_(\d{4}-\d{2}-\d{2})$/.exec(k);
    if (!m) continue;
    const day = legacy<{ pagesRead?: (string | number)[] }>(k, {});
    const pages = (day.pagesRead || []).map(Number).filter((p) => p >= 1 && p <= 604);
    if (pages.length) log[m[1]] = { pages, azkar: [], listen: 0 };
  }
  write('log', log);

  // Stats & badges
  const gami = legacy<{ azkarTotal?: number; unlockedBadges?: string[] }>('gami_data', {});
  write('stats', {
    azkarTotal: gami.azkarTotal || 0,
    tasbeehTotal: 0,
    surahsListened: 0,
    khatmas: 0,
    badges: (gami.unlockedBadges || []).filter((b) => b !== 'first_werd' && b !== 'hifz_master'),
  });

  // Prayer location typed by the user (geocoded later by the prayer screen)
  if (localStorage.getItem('prayer_city_manual') === 'true') {
    write('prayer:legacyCity', {
      city: localStorage.getItem('prayer_city') || '',
      country: localStorage.getItem('prayer_country') || '',
    });
  }

  // Drop the old sync-engine caches; they can be large and are useless now.
  const drop: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || '';
    if (k.startsWith('sync_cache_') || k === 'active_view' || k === 'usage') drop.push(k);
  }
  drop.forEach((k) => localStorage.removeItem(k));

  write(DONE, Date.now());
}

try {
  migrate();
} catch (err) {
  console.warn('[taratil] migration skipped', err);
}
