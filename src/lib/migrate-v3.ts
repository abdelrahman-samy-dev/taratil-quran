/**
 * One-time migration from Taratil v3 (plain localStorage keys) to v4 (namespaced).
 *
 * This module is imported by lib/storage.ts, so it runs before ANY persisted signal
 * reads storage — in dev and in the production bundle alike. It must not import
 * storage.ts (that would create a cycle), so it talks to localStorage directly.
 *
 * Every legacy item is migrated on its own: one malformed value is skipped instead
 * of aborting the whole run, and the "done" flag is always set, so the migration can
 * never re-run and overwrite newer data.
 */
const NS = 'taratil:';
const DONE = `${NS}migrated:v3`;

type Json = Record<string, unknown>;

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function step(name: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn(`[taratil] migration step "${name}" skipped`, err);
  }
}

const isPage = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 604;

export function migrateV3(): void {
  const s = ls();
  if (!s || s.getItem(DONE)) return;
  const get = (k: string) => s.getItem(k);
  const put = (k: string, v: unknown) => s.setItem(NS + k, JSON.stringify(v));
  const has = (k: string) => get(k) != null;

  try {
    const anyLegacy = ['prefs_theme', 'mushaf_last_page', 'mushaf_bookmarks', 'gami_data', 'usage', 'prefs_shape'].some(has);
    if (!anyLegacy) return;

    step('prefs', () => {
      const prefs = parse<Json>(get(`${NS}prefs`), {});
      const theme = get('prefs_theme');
      if (theme === 'light' || theme === 'dark' || theme === 'amoled') prefs.theme = theme;
      const shape = (get('prefs_shape') || '').replace('shape-', '');
      if (shape === 'rounded' || shape === 'sharp' || shape === 'minimal') prefs.shape = shape;
      const fs = Number.parseFloat(get('prefs_fontScale') || '');
      if (fs >= 0.8 && fs <= 1.5) prefs.fontScale = Math.min(1.3, Math.max(0.85, fs));
      if (has('prefs_autoplay')) prefs.autoplay = get('prefs_autoplay') !== 'false';
      if (has('prefs_haptics')) prefs.haptics = get('prefs_haptics') !== 'false';
      const night = Number.parseFloat(get('mushaf_night') || '');
      if (night > 0) prefs.mushafDim = Math.min(0.6, night);
      put('prefs', prefs);
    });

    step('tafsir', () => {
      const surah = Number.parseInt(get('continue_reading_surah') || '', 10);
      if (surah >= 1 && surah <= 114) put('tafsir:last', surah);
    });

    step('lastRead', () => {
      const page = Number.parseInt(get('mushaf_last_page') || '', 10);
      if (isPage(page)) put('lastRead', { page, at: Date.now() });
    });

    step('bookmarks', () => {
      const old = parse<unknown>(get('mushaf_bookmarks'), []);
      if (!Array.isArray(old)) return;
      const now = Date.now();
      const marks = old
        .filter((b): b is { page: number; label?: unknown } => !!b && typeof b === 'object' && isPage((b as Json).page))
        .map((b, i) => ({
          id: `m${now}${i}`,
          page: b.page,
          label: typeof b.label === 'string' && b.label ? b.label : 'عام',
          at: now - i,
        }));
      if (marks.length) put('bookmarks', marks);
    });

    step('werd', () => {
      const goal = Number.parseInt(get('mushaf_werd_goal') || '', 10);
      put('werd', { goal: goal > 0 && goal <= 604 ? goal : 10, plan: null });
    });

    step('log', () => {
      const log: Record<string, { pages: number[]; azkar: string[]; listen: number }> = {};
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i) || '';
        const m = /^mushaf_werd_(\d{4}-\d{2}-\d{2})$/.exec(k);
        if (!m) continue;
        const day = parse<unknown>(get(k), null);
        const raw = day && typeof day === 'object' ? (day as Json).pagesRead : null;
        if (!Array.isArray(raw)) continue;
        const pages = [...new Set(raw.map(Number).filter(isPage))];
        if (pages.length) log[m[1]] = { pages, azkar: [], listen: 0 };
      }
      if (Object.keys(log).length) put('log', log);
    });

    step('stats', () => {
      const gami = parse<unknown>(get('gami_data'), {});
      const g = gami && typeof gami === 'object' ? (gami as Json) : {};
      const total = Number(g.azkarTotal);
      const badges = Array.isArray(g.unlockedBadges)
        ? g.unlockedBadges.filter((b): b is string => typeof b === 'string' && b !== 'first_werd' && b !== 'hifz_master')
        : [];
      put('stats', {
        azkarTotal: Number.isFinite(total) && total > 0 ? Math.floor(total) : 0,
        tasbeehTotal: 0,
        surahsListened: 0,
        khatmas: 0,
        badges,
      });
    });

    step('prayer', () => {
      if (get('prayer_city_manual') === 'true') {
        put('prayer:legacyCity', { city: get('prayer_city') || '', country: get('prayer_country') || '' });
      }
    });

    step('cleanup', () => {
      // Old sync-engine caches can be large and are useless now.
      const drop: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i) || '';
        if (k.startsWith('sync_cache_') || k === 'active_view' || k === 'usage') drop.push(k);
      }
      drop.forEach((k) => s.removeItem(k));
    });
  } finally {
    try {
      s.setItem(DONE, JSON.stringify(Date.now()));
    } catch {
      /* storage full: nothing more we can do */
    }
  }
}

migrateV3();
