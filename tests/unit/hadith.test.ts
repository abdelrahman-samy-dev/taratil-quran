import { describe, expect, it } from 'vitest';
import { BOOKS, sectionTitle } from '../../src/features/hadith/catalog';
import { dayNumber, pickDaily } from '../../src/features/hadith/daily';
import {
  arabicLetters,
  buildIndex,
  buildSections,
  highlight,
  indexOfAltNumber,
  indexOfNumber,
  matches,
  queryTerms,
  search,
} from '../../src/features/hadith/data';
import { gradeTone, translateGrade } from '../../src/features/hadith/grades';
import { normalizeArabic } from '../../src/lib/arabic';

const NIYYAT =
  'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى';

describe('hadith search', () => {
  it('matches regardless of diacritics and hamza forms', () => {
    const norm = normalizeArabic(NIYYAT);
    expect(matches(norm, queryTerms('انما الاعمال بالنيات'))).toBe(true);
    expect(matches(norm, queryTerms('إنما الأعمال'))).toBe(true);
    expect(matches(norm, queryTerms('الْأَعْمَالُ'))).toBe(true);
  });

  it('requires every word (in any order)', () => {
    const norm = normalizeArabic(NIYYAT);
    expect(matches(norm, queryTerms('نوى الاعمال'))).toBe(true);
    expect(matches(norm, queryTerms('الاعمال الصلاة'))).toBe(false);
    expect(matches(norm, queryTerms('   '))).toBe(false);
  });

  it('builds the index in slices and finds matching hadith', async () => {
    const texts = [NIYYAT, 'بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ', 'الدِّينُ النَّصِيحَةُ', 'إِنَّ اللَّهَ طَيِّبٌ'];
    const many = Array.from({ length: 400 }, (_, i) => texts[i % texts.length]);
    const progress: number[] = [];
    const index = await buildIndex(many, (p) => progress.push(p));
    expect(index).toHaveLength(400);
    expect(progress[progress.length - 1]).toBe(1);
    expect(search(index, 'الاسلام خمس')).toHaveLength(100);
    expect(search(index, 'النصيحه')[0]).toBe(2); // taa marbuta folded
    expect(search(index, '')).toEqual([]);
  });

  it('highlights matches in the diacritised text', () => {
    const parts = highlight(NIYYAT, queryTerms('الاعمال'));
    const hits = parts.filter((p) => p.hit).map((p) => p.t);
    expect(hits).toEqual(['الْأَعْمَالُ']);
    expect(parts.map((p) => p.t).join('')).toBe(NIYYAT);
  });

  it('converts Persian yeh/kaf used by one edition', () => {
    expect(arabicLetters('لَیْسَ الْخَبَرُ کَالْمُعَایَنَةِ')).toBe('لَيْسَ الْخَبَرُ كَالْمُعَايَنَةِ');
    expect(arabicLetters('علی الله')).toBe('على الله');
  });
});

describe('hadith of the day', () => {
  it('is deterministic for a calendar date', () => {
    const a = pickDaily(new Date(2026, 10, 11, 0, 5));
    const b = pickDaily(new Date(2026, 10, 11, 23, 55));
    expect(a).toEqual(b);
  });

  it('changes from one day to the next and alternates books', () => {
    const a = pickDaily(new Date(2026, 10, 11));
    const b = pickDaily(new Date(2026, 10, 12));
    expect(a.book).not.toBe(b.book);
    expect(['nawawi', 'qudsi']).toContain(a.book);
  });

  it('always picks a valid number and covers the whole collection', () => {
    const seen = { nawawi: new Set<number>(), qudsi: new Set<number>() };
    for (let i = 0; i < 200; i++) {
      const p = pickDaily(new Date(2026, 0, 1 + i));
      const max = p.book === 'nawawi' ? 42 : 40;
      expect(p.number).toBeGreaterThanOrEqual(1);
      expect(p.number).toBeLessThanOrEqual(max);
      seen[p.book as 'nawawi' | 'qudsi'].add(p.number);
    }
    expect(seen.nawawi.size).toBe(42);
    expect(seen.qudsi.size).toBe(40);
  });

  it('counts days by the local calendar', () => {
    expect(dayNumber(new Date(2026, 10, 12, 0, 1)) - dayNumber(new Date(2026, 10, 11, 23, 59))).toBe(1);
  });
});

describe('sections', () => {
  it('ignores stray references and never goes backwards', () => {
    // book 0 is noise here (unnamed), 43 is a stray tag inside book 1
    const refs = [1, 1, 0, 1, 43, 1, 2, 2, 0, 2, 3, 2, 3, 3, 3];
    const hadiths = refs.map((_, i) => ({ n: i + 1, sec: -1 }));
    const names = { '0': '', '1': 'A', '2': 'B', '3': 'C', '43': 'X' };
    const s = buildSections(refs, names, hadiths);
    expect(s.map((x) => x.id)).toEqual([1, 2, 3]);
    expect(s.map((x) => [x.first, x.last])).toEqual([
      [1, 6],
      [7, 12],
      [13, 15],
    ]);
    expect(hadiths[4].sec).toBe(0);
    expect(hadiths[10].sec).toBe(1); // a lone "3" followed by a "2" does not start book 3
  });

  it('keeps a named introduction (book 0)', () => {
    const refs = [0, 0, 1, 1, 1, 1, 1, 1];
    const hadiths = refs.map((_, i) => ({ n: i + 1, sec: -1 }));
    const s = buildSections(refs, { '0': 'Introduction', '1': 'Faith' }, hadiths);
    expect(s.map((x) => x.id)).toEqual([0, 1]);
  });

  it('has verified Arabic titles only where provided', () => {
    expect(sectionTitle('bukhari', 1)).toBe('كتاب بدء الوحي');
    expect(sectionTitle('bukhari', 97)).toBe('كتاب التوحيد');
    expect(sectionTitle('muslim', 0)).toBe('المقدمة');
    expect(sectionTitle('muslim', 56)).toBe('كتاب التفسير');
    expect(sectionTitle('abudawud', 1)).toBeNull();
  });
});

describe('numbers', () => {
  const hs = [{ n: 1 }, { n: 2 }, { n: 402 }, { n: 402.2 }, { n: 403 }, { n: 7563 }];
  it('finds a hadith number or the next available one', () => {
    expect(indexOfNumber(hs, 402)).toBe(2);
    expect(indexOfNumber(hs, 402.2)).toBe(3);
    expect(indexOfNumber(hs, 300)).toBe(2);
    expect(indexOfNumber(hs, 9000)).toBe(-1);
  });
  it('finds a hadith by its Abd al-Baqi number', () => {
    const m = [{ alt: '8.01' }, { alt: '8.02' }, { alt: '1907' }, {}];
    expect(indexOfAltNumber(m, 8)).toBe(0);
    expect(indexOfAltNumber(m, 1907)).toBe(2);
    expect(indexOfAltNumber(m, 5)).toBe(-1);
  });
});

describe('grades', () => {
  it('translates the common terms', () => {
    expect(translateGrade('Sahih')).toBe('صحيح');
    expect(translateGrade('Daif')).toBe('ضعيف');
    expect(translateGrade('Hasan Sahih')).toBe('حسن صحيح');
    expect(translateGrade('Isnaad Hasan')).toBe('إسناده حسن');
    expect(translateGrade('Sahih Isnaad')).toBe('صحيح الإسناد');
    expect(translateGrade('Very Daif')).toBe('ضعيف جدًا');
    expect(translateGrade('Sahih Lighairihi')).toBe('صحيح لغيره');
    expect(translateGrade('Sahih - Agreed Upon')).toBe('صحيح، متفق عليه');
    expect(translateGrade('Sahih - Bukhari And Muslim')).toBe('صحيح، رواه البخاري ومسلم');
    expect(translateGrade('Mauquf Sahih')).toBe('موقوف صحيح');
    expect(translateGrade('Isnaad Sahih Bukhari And Muslim')).toBe('إسناده صحيح، رواه البخاري ومسلم');
  });

  it('translates book references with numbers', () => {
    expect(translateGrade('Sahih Bukhari (1023) Sahih Muslim (894)')).toBe('صحيح البخاري (١٠٢٣)، صحيح مسلم (٨٩٤)');
    expect(translateGrade('Sahih Muslim (715 After 1928)')).toBe('صحيح مسلم (٧١٥ بعد ١٩٢٨)');
  });

  it('drops empty or unknown grades instead of showing English', () => {
    expect(translateGrade('-')).toBeNull();
    expect(translateGrade('')).toBeNull();
    expect(translateGrade('Something Else')).toBeNull();
  });

  it('colours weak grades as weak even when "sahih" appears', () => {
    expect(gradeTone('Daif Isnaad')).toBe('daif');
    expect(gradeTone('Shadh, Sahih')).toBe('daif');
    expect(gradeTone('Hasan')).toBe('hasan');
    expect(gradeTone('Sahih Lighairihi')).toBe('sahih');
  });
});

describe('catalog', () => {
  it('lists the ten Arabic books with unique slugs', () => {
    expect(BOOKS).toHaveLength(10);
    expect(new Set(BOOKS.map((b) => b.slug)).size).toBe(10);
  });
});
