import { beforeEach, describe, expect, it } from 'vitest';
import { keys, NS, read, readRaw, write } from '../../src/lib/storage';
import {
  APP_VERSION,
  applyBackup,
  backupFileName,
  createBackup,
  parseBackup,
  wipeAll,
} from '../../src/features/settings/backup';

const SAMPLE = {
  prefs: { theme: 'dark', fontScale: 1.1 },
  log: { '2026-11-10': { pages: [1, 2, 3], azkar: ['morning'], listen: 600 } },
  bookmarks: [{ id: 'b1', page: 42, key: '2:255', label: 'تدبر', at: 1 }],
  werd: { goal: 5, plan: { start: '2026-11-01', days: 30, fromPage: 1 } },
  stats: { azkarTotal: 120, tasbeehTotal: 33, surahsListened: 2, khatmas: 0, badges: ['first_page'] },
  'reciters:fav': [118],
};

function seed() {
  for (const [k, v] of Object.entries(SAMPLE)) write(k, v);
  write('downloads', [{ url: 'https://a/001.mp3', title: 'الفاتحة', size: 10, at: 1 }]);
}

beforeEach(() => localStorage.clear());

describe('backup export', () => {
  it('collects every namespaced key except device-only ones', () => {
    seed();
    localStorage.setItem('not-ours', 'x');
    const b = createBackup(new Date('2026-11-11T08:00:00Z'));
    expect(b.app).toBe('taratil');
    expect(b.version).toBe(APP_VERSION);
    expect(b.exportedAt).toBe('2026-11-11T08:00:00.000Z');
    expect(b.data).toEqual(SAMPLE);
    expect(b.data).not.toHaveProperty('downloads');
    expect(b.data).not.toHaveProperty('not-ours');
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 10, 11, 23, 59))).toBe('taratil-backup-2026-11-11.json');
  });
});

describe('backup import', () => {
  it('round-trips through JSON and replaces current data', () => {
    seed();
    const text = JSON.stringify(createBackup());

    localStorage.clear();
    write('prefs', { theme: 'light' });
    write('stale', 1);
    write('downloads', [{ url: 'https://b/002.mp3', title: 'البقرة', size: 20, at: 2 }]);

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(applyBackup(parsed.backup)).toBe(Object.keys(SAMPLE).length);

    for (const [k, v] of Object.entries(SAMPLE)) expect(read(k, null)).toEqual(v);
    expect(readRaw('stale')).toBeNull();
    // This device's downloads list survives; v3 migration stays marked as done.
    expect(read<{ title: string }[]>('downloads', [])[0].title).toBe('البقرة');
    expect(readRaw('migrated:v3')).not.toBeNull();
  });

  it.each([
    ['empty text', ''],
    ['not JSON', '{oops'],
    ['an array', '[]'],
    ['another app', JSON.stringify({ app: 'other', version: '4.0.0', data: { prefs: {} } })],
    ['no version', JSON.stringify({ app: 'taratil', data: { prefs: {} } })],
    ['a newer major version', JSON.stringify({ app: 'taratil', version: '9.0.0', data: { prefs: {} } })],
    ['data as array', JSON.stringify({ app: 'taratil', version: '4.0.0', data: [] })],
    ['empty data', JSON.stringify({ app: 'taratil', version: '4.0.0', data: {} })],
    ['bad keys', JSON.stringify({ app: 'taratil', version: '4.0.0', data: { 'bad key!': 1 } })],
    ['bookmarks not a list', JSON.stringify({ app: 'taratil', version: '4.0.0', data: { bookmarks: {} } })],
    ['prefs not an object', JSON.stringify({ app: 'taratil', version: '4.0.0', data: { prefs: 'dark' } })],
  ])('rejects %s', (_label, text) => {
    write('prefs', { theme: 'light' });
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    // Nothing was touched.
    expect(read('prefs', null)).toEqual({ theme: 'light' });
  });

  it('accepts older v4 files without exportedAt', () => {
    const r = parseBackup(JSON.stringify({ app: 'taratil', version: '4.0.0', data: { prefs: { theme: 'amoled' } } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.exportedAt).toBe('');
  });
});

describe('reset', () => {
  it('removes every key and keeps the migration marker', () => {
    seed();
    wipeAll();
    expect(keys()).toEqual(['migrated:v3']);
    expect(localStorage.getItem(`${NS}prefs`)).toBeNull();
  });
});
