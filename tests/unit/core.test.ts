import { describe, expect, it, beforeEach } from 'vitest';
import { arNum, normalizeArabic, parseArNum, stripDiacritics } from '../../src/lib/arabic';
import { addDays, dayKey, read, write, keys, NS } from '../../src/lib/storage';
import { verseAt, type VerseTimings } from '../../src/audio/timing';
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
