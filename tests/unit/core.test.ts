import { describe, expect, it, beforeEach } from 'vitest';
import { arNum, normalizeArabic, parseArNum, stripDiacritics } from '../../src/lib/arabic';
import { addDays, dayKey, read, write, keys, NS } from '../../src/lib/storage';
import { alignTimings, verseAt, type VerseTimings } from '../../src/audio/timing';
import { chapterAtPage, chapters, juzAtPage, JUZ_PAGES } from '../../src/quran/data';

describe('arabic helpers', () => {
  it('normalises hamza forms, taa marbuta, alef maqsura and tashkeel', () => {
    expect(normalizeArabic('إِنَّ ٱلصَّلَوٰةَ')).toBe('ان الصلوه');
    expect(normalizeArabic('أَعُوذُ بِاللَّهِ')).toBe(normalizeArabic('اعوذ بالله'));
    expect(normalizeArabic('مُوسَىٰ')).toBe('موسي');
    expect(normalizeArabic('  سورة   البقرة ')).toBe('سوره البقره');
  });

  it('converts digits both ways', () => {
    expect(arNum(2026)).toBe('٢٠٢٦');
    expect(parseArNum('٢٥٥')).toBe(255);
    expect(parseArNum('604')).toBe(604);
  });

  it('strips diacritics but keeps letters', () => {
    expect(stripDiacritics('بِسۡمِ ٱللَّهِ')).toBe('بسم ٱلله');
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips JSON under the namespace', () => {
    write('x', { a: 1 });
    expect(localStorage.getItem(`${NS}x`)).toBe('{"a":1}');
    expect(read('x', null)).toEqual({ a: 1 });
    expect(keys()).toContain('x');
  });

  it('falls back on corrupt values', () => {
    localStorage.setItem(`${NS}bad`, '{oops');
    expect(read('bad', 5)).toBe(5);
  });

  it('computes local day keys and offsets', () => {
    expect(dayKey(new Date(2026, 10, 11, 23, 59))).toBe('2026-11-11');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('verse timing lookup', () => {
  const t: VerseTimings = { starts: [2.7, 5.7, 10.6, 14.1], ends: [5.7, 10.6, 14.1, 17.3], exact: true };

  it('returns -1 during the intro and the right verse afterwards', () => {
    expect(verseAt(t, 0)).toBe(-1);
    expect(verseAt(t, 2.7)).toBe(0);
    expect(verseAt(t, 9)).toBe(1);
    expect(verseAt(t, 14.2)).toBe(3);
    expect(verseAt(t, 999)).toBe(3);
  });
});

describe('aligning mp3quran timing rows to Hafs verses', () => {
  const rows = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ ayah: from + i, start_time: i * 1000, end_time: i * 1000 + 900 }));

  it('keeps clean 1..n numbering', () => {
    expect(alignTimings(rows(1, 7), 7)?.starts).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('drops an istiadha lead-in row numbered 0', () => {
    expect(alignTimings(rows(0, 7), 7)?.starts).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('treats 0..n-1 numbering as shifted by one (Al-Fatiha for some reciters)', () => {
    const t = alignTimings(rows(0, 6), 7)!;
    expect(t.starts).toHaveLength(7);
    expect(t.starts[0]).toBe(0); // verse 1 starts with the first row
    expect(verseAt(t, 6.5)).toBe(6); // last verse
  });

  it('refuses other verse counts (other riwayat)', () => {
    expect(alignTimings(rows(1, 285), 286)).toBeNull();
    expect(alignTimings(rows(1, 130), 129)).toBeNull();
  });
});

describe('quran data', () => {
  it('has 114 surahs and 6236 ayat', () => {
    expect(chapters).toHaveLength(114);
    expect(chapters.reduce((n, c) => n + c.verses, 0)).toBe(6236);
  });

  it('finds the surah at the top of a page', () => {
    expect(chapterAtPage(1).id).toBe(1);
    expect(chapterAtPage(50).id).toBe(3);
    expect(chapterAtPage(604).id).toBe(112);
  });

  it('maps pages to juz', () => {
    expect(JUZ_PAGES).toHaveLength(30);
    expect(juzAtPage(1)).toBe(1);
    expect(juzAtPage(22)).toBe(2);
    expect(juzAtPage(604)).toBe(30);
  });
});
