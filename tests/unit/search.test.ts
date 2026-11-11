import { describe, expect, it } from 'vitest';
import { normalizeArabic } from '../../src/lib/arabic';
import {
  buildIndex,
  highlight,
  indexOf,
  letterCount,
  matchSurahs,
  normalizeWithMap,
  pageOf,
  parseReference,
  searchIndex,
  surahByName,
  toWesternDigits,
  type Entry,
  type Row,
} from '../../src/features/search/engine';
import { ayahCitation } from '../../src/features/tafsir/text';
// ?raw keeps TypeScript from type-checking megabytes of JSON.
import searchRaw from '../../public/data/quran/search.json?raw';
import t2 from '../../public/data/quran/text/2.json?raw';
import t18 from '../../public/data/quran/text/18.json?raw';
import t36 from '../../public/data/quran/text/36.json?raw';
import t67 from '../../public/data/quran/text/67.json?raw';
import t112 from '../../public/data/quran/text/112.json?raw';

const rows = JSON.parse(searchRaw) as Row[];
let index: Entry[];

describe('normalisation', () => {
  it('folds hamza forms, taa marbuta, alef maqsura and strips tashkeel', () => {
    expect(normalizeArabic('إِنَّ اللَّهَ مَعَ الصَّابِرِينَ')).toBe('ان الله مع الصابرين');
    expect(normalizeArabic('ٱلْحَمْدُ لِلَّهِ')).toBe('الحمد لله');
    expect(normalizeArabic('الصلاة')).toBe(normalizeArabic('الصلاه'));
    expect(normalizeArabic('موسى')).toBe('موسي');
    expect(normalizeArabic('مؤمنون')).toBe('مومنون');
  });

  it('normalizeWithMap matches normalizeArabic for every ayah and maps back to source characters', () => {
    for (const [, , t] of rows) {
      const { norm, map } = normalizeWithMap(t);
      expect(norm).toBe(normalizeArabic(t));
      expect(map.length).toBe(norm.length);
    }
    const t = 'وَقَالَ لَهُمْ';
    const { norm, map } = normalizeWithMap(t);
    expect(norm).toBe('وقال لهم');
    expect(t[map[4]]).toBe(' ');
  });
});

describe('index & matching', () => {
  it('builds one entry per ayah in mushaf order', async () => {
    index = await buildIndex(rows, 0);
    expect(index).toHaveLength(6236);
    expect(index[indexOf(2, 255)]).toMatchObject({ s: 2, a: 255 });
    expect(index[indexOf(114, 6)]).toMatchObject({ s: 114, a: 6 });
  });

  it('needs at least two letters', () => {
    expect(searchIndex(index, 'ا')).toBeNull();
    expect(searchIndex(index, ' ' )).toBeNull();
    expect(letterCount('َا')).toBe(1);
    expect(searchIndex(index, 'صبر')).not.toBeNull();
  });

  it('matches regardless of tashkeel and hamza spelling', () => {
    const plain = searchIndex(index, 'الحي القيوم')!;
    const marked = searchIndex(index, 'الْحَيُّ الْقَيُّومُ')!;
    expect(plain.exact).toEqual(marked.exact);
    const keys = plain.exact.map((i) => `${index[i].s}:${index[i].a}`);
    expect(keys).toEqual(['2:255', '3:2']); // 20:111 reads «لِلْحَيِّ», no match
    // "يا أيها الذين آمنوا" with and without hamzas
    expect(searchIndex(index, 'يا ايها الذين امنوا')!.exact.length).toBe(
      searchIndex(index, 'يَا أَيُّهَا الَّذِينَ آمَنُوا')!.exact.length,
    );
  });

  it('falls back to all words in any order', () => {
    const r = searchIndex(index, 'القيوم الحي')!;
    expect(r.exact).toEqual([]);
    expect(r.loose.map((i) => `${index[i].s}:${index[i].a}`)).toContain('2:255');
    expect(r.terms).toEqual(['القيوم', 'الحي']);
  });
});

describe('highlight', () => {
  it('marks whole words containing the match', () => {
    const t = index[indexOf(2, 255)].t;
    const segs = highlight(t, ['القيوم']);
    const marked = segs.filter((s) => s.m).map((s) => s.t);
    expect(marked).toHaveLength(1);
    expect(normalizeArabic(marked[0])).toBe('القيوم');
    expect(segs.map((s) => s.t).join('')).toBe(t);
  });

  it('merges adjacent words of a phrase into one mark', () => {
    const t = index[indexOf(2, 255)].t;
    const marked = highlight(t, ['الحي القيوم']).filter((s) => s.m);
    expect(marked).toHaveLength(1);
    expect(normalizeArabic(marked[0].t)).toBe('الحي القيوم');
  });

  it('returns the text unchanged when nothing matches', () => {
    expect(highlight('بِسْمِ اللَّهِ', ['زكاه'])).toEqual([{ t: 'بِسْمِ اللَّهِ', m: false }]);
  });
});

describe('references', () => {
  it('parses numeric references in both digit sets', () => {
    expect(parseReference('2:255')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('٢:٢٥٥')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('2 255')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('١١٤/٦')).toEqual({ surah: 114, ayah: 6 });
    expect(parseReference('36')).toEqual({ surah: 36 });
  });

  it('parses a surah name followed by an ayah number', () => {
    expect(parseReference('البقرة 255')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('البقرة ٢٥٥')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('البقره:255')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('سورة البقرة آية ٢٥٥')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('بقرة 255')).toEqual({ surah: 2, ayah: 255 });
    expect(parseReference('آل عمران 7')).toEqual({ surah: 3, ayah: 7 });
    expect(parseReference('Al-Baqarah 255')).toEqual({ surah: 2, ayah: 255 });
  });

  it('rejects ayat outside the surah and plain words', () => {
    expect(parseReference('2:300')).toBeNull();
    expect(parseReference('115:1')).toBeNull();
    expect(parseReference('0')).toBeNull();
    expect(parseReference('الفاتحة 8')).toBeNull();
    expect(parseReference('الرحمن الرحيم')).toBeNull();
    expect(parseReference('')).toBeNull();
  });

  it('converts Arabic-Indic and Persian digits', () => {
    expect(toWesternDigits('٢:٢٥٥ ۲۵۵')).toBe('2:255 255');
  });
});

describe('surah names', () => {
  it('finds exact names with or without ال and common aliases', () => {
    expect(surahByName('يس')?.id).toBe(36);
    expect(surahByName('سورة الكهف')?.id).toBe(18);
    expect(surahByName('كهف')?.id).toBe(18);
    expect(surahByName('براءة')?.id).toBe(9);
    expect(surahByName('الإسراء')?.id).toBe(17);
    expect(surahByName('baqarah')?.id).toBe(2);
    expect(surahByName('الصبر')).toBeNull();
  });

  it('lists partial matches, exact first', () => {
    expect(matchSurahs('الرحمن')[0].id).toBe(55);
    const ids = matchSurahs('المؤمن').map((c) => c.id);
    expect(ids[0]).toBe(40); // المؤمن is another name of غافر
    expect(ids).toContain(23); // المؤمنون
    expect(matchSurahs('ال')).toEqual([]);
    expect(matchSurahs('ق').length).toBe(0);
  });
});

describe('pages', () => {
  it('computes the mushaf page of any ayah', () => {
    expect(pageOf(1, 1)).toBe(1);
    expect(pageOf(2, 1)).toBe(2);
    expect(pageOf(2, 255)).toBe(42);
    expect(pageOf(18, 1)).toBe(293);
    expect(pageOf(114, 6)).toBe(604);
  });

  it('agrees with the per-ayah pages shipped in text/{surah}.json', () => {
    const files: Record<number, string> = { 2: t2, 18: t18, 36: t36, 67: t67, 112: t112 };
    for (const [s, raw] of Object.entries(files).map(([k, v]) => [Number(k), v] as const)) {
      const data = JSON.parse(raw) as { p: number[] };
      data.p.forEach((p, i) => expect(pageOf(s, i + 1)).toBe(p));
    }
  });
});

describe('citation format', () => {
  it('formats an ayah for copy and share', () => {
    expect(ayahCitation('ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ', 2, 255)).toBe('﴿ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ﴾ [البقرة: ٢٥٥]');
    expect(ayahCitation(' قُلْ هُوَ ٱللَّهُ أَحَدٌ ', 112, 1)).toBe('﴿قُلْ هُوَ ٱللَّهُ أَحَدٌ﴾ [الإخلاص: ١]');
  });
});
