/**
 * Backup / restore of everything Taratil keeps under the 'taratil:' namespace,
 * plus the cache and reset helpers used by the data settings.
 */
import { AUDIO_CACHE } from '../../audio/offline';
import { dayKey, keys, readRaw, remove, write } from '../../lib/storage';

export const APP_ID = 'taratil';
export const APP_VERSION = '4.0.0';

/** Keys tied to this device (e.g. the list of cached audio files): never exported or overwritten. */
const DEVICE_ONLY = new Set(['downloads']);
/** Set by state/migrate.ts; must stay set or v3 leftovers would be imported again. */
const MIGRATED = 'migrated:v3';
const KEY_RE = /^[A-Za-z0-9_:.-]{1,120}$/;
const MAX_KEYS = 1000;
const MAX_CHARS = 8 * 1024 * 1024;

export interface Backup {
  app: typeof APP_ID;
  version: string;
  exportedAt: string;
  data: Record<string, unknown>;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function createBackup(now = new Date()): Backup {
  const data: Record<string, unknown> = {};
  for (const k of keys().sort()) {
    if (DEVICE_ONLY.has(k) || k.startsWith('__')) continue;
    const raw = readRaw(k);
    if (raw == null) continue;
    try {
      data[k] = JSON.parse(raw);
    } catch {
      data[k] = raw;
    }
  }
  return { app: APP_ID, version: APP_VERSION, exportedAt: now.toISOString(), data };
}

export function backupFileName(now = new Date()): string {
  return `taratil-backup-${dayKey(now)}.json`;
}

/** Saves the backup as a JSON file. Returns the number of entries written. */
export function downloadBackup(now = new Date()): number {
  const backup = createBackup(now);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName(now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return Object.keys(backup.data).length;
}

const fail = (error: string): ParseResult => ({ ok: false, error });

/** Validates a backup file's text. Error messages are user-facing Arabic. */
export function parseBackup(text: string): ParseResult {
  if (!text || text.length > MAX_CHARS) return fail('الملف فارغ أو أكبر من المتوقع.');
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return fail('الملف ليس بصيغة صحيحة.');
  }
  if (!isObject(v) || v.app !== APP_ID) return fail('هذا الملف ليس نسخة احتياطية من تراتيل.');
  if (typeof v.version !== 'string' || !/^\d+\.\d+/.test(v.version)) return fail('إصدار النسخة غير معروف.');
  if (Number.parseInt(v.version, 10) > Number.parseInt(APP_VERSION, 10)) {
    return fail('هذه النسخة من إصدار أحدث من تراتيل. حدّث التطبيق ثم أعد المحاولة.');
  }
  if (!isObject(v.data)) return fail('محتوى النسخة غير صالح.');
  const entries = Object.entries(v.data);
  if (!entries.length) return fail('النسخة لا تحتوي على بيانات.');
  if (entries.length > MAX_KEYS) return fail('النسخة تحتوي على بيانات أكثر من المتوقع.');
  if (entries.some(([k]) => !KEY_RE.test(k))) return fail('النسخة تحتوي على بيانات غير معروفة.');

  // Shape checks for the data the app relies on.
  const d = v.data;
  const objects = ['prefs', 'log', 'werd', 'stats', 'lastRead'];
  if (objects.some((k) => k in d && !isObject(d[k])) || ('bookmarks' in d && !Array.isArray(d.bookmarks))) {
    return fail('بعض بيانات النسخة تالفة.');
  }

  return {
    ok: true,
    backup: {
      app: APP_ID,
      version: v.version,
      exportedAt: typeof v.exportedAt === 'string' ? v.exportedAt : '',
      data: d,
    },
  };
}

/**
 * Replaces the stored data with the backup's (device-only keys are kept).
 * The caller reloads the page afterwards so every signal starts fresh.
 */
export function applyBackup(backup: Backup): number {
  for (const k of keys()) if (!DEVICE_ONLY.has(k)) remove(k);
  let n = 0;
  for (const [k, v] of Object.entries(backup.data)) {
    if (DEVICE_ONLY.has(k)) continue;
    write(k, v);
    n++;
  }
  if (readRaw(MIGRATED) == null) write(MIGRATED, Date.now());
  return n;
}

/** Removes every key in the namespace (the caller reloads afterwards). */
export function wipeAll(): void {
  for (const k of keys()) remove(k);
  write(MIGRATED, Date.now());
}

/** Deletes the service worker content caches; downloaded recitations are kept. */
export async function clearContentCaches(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  const names = (await caches.keys()).filter((n) => n.startsWith('taratil-') && n !== AUDIO_CACHE);
  await Promise.all(names.map((n) => caches.delete(n)));
  return names.length;
}
