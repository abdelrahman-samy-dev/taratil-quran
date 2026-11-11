import { describe, expect, it } from 'vitest';
import { EDITIONS, resolveEdition } from '../../src/features/tafsir/editions';
import { ayahWords, clampScale, nextHidden, paragraphs, preview, quotePieces } from '../../src/features/tafsir/text';

describe('editions', () => {
  it('falls back to the Muyassar for unknown ids', () => {
    expect(resolveEdition('ar.qurtubi').id).toBe('ar.qurtubi');
    expect(resolveEdition('en.sahih').id).toBe('ar.muyassar');
    expect(resolveEdition(undefined).id).toBe('ar.muyassar');
    expect(new Set(EDITIONS.map((e) => e.id)).size).toBe(EDITIONS.length);
  });
});

describe('text scale', () => {
  it('stays within 0.8 – 1.8 without float noise', () => {
    expect(clampScale(1 + 0.1 + 0.1)).toBe(1.2);
    expect(clampScale(0.5)).toBe(0.8);
    expect(clampScale(2.4)).toBe(1.8);
    expect(clampScale(Number.NaN)).toBe(1);
  });
});

describe('paragraphs', () => {
  const sentence = 'هذا كلام في تفسير الآية يوضح معناها ويذكر أقوال العلماء فيها بإيجاز.';
  const long = Array.from({ length: 20 }, () => sentence).join(' ');

  it('keeps short texts as one paragraph', () => {
    expect(paragraphs(sentence)).toEqual([sentence]);
    expect(paragraphs('   ')).toEqual([]);
  });

  it('splits long blocks at sentence ends without losing words', () => {
    const ps = paragraphs(long, 300);
    expect(ps.length).toBeGreaterThan(2);
    expect(ps.every((p) => p.endsWith('.'))).toBe(true);
    expect(ps.join(' ').replace(/\s+/g, ' ')).toBe(long);
  });

  it('never splits inside a {quotation}', () => {
    const inner = `{ ${long} }`;
    expect(paragraphs(`${inner} تم.`, 100)).toHaveLength(1);
  });

  it('adds the missing space after a full stop joined to the next word', () => {
    expect(paragraphs('انتهى الكلام.وقد قيل غير ذلك.')).toEqual(['انتهى الكلام. وقد قيل غير ذلك.']);
  });
});

describe('quotations', () => {
  it('separates {Quran quotations} from the commentary', () => {
    expect(quotePieces('قوله { الحمد لله } أي الثناء')).toEqual([
      { t: 'قوله ', q: false },
      { t: 'الحمد لله', q: true },
      { t: ' أي الثناء', q: false },
    ]);
    expect(quotePieces('بلا اقتباس')).toEqual([{ t: 'بلا اقتباس', q: false }]);
  });
});

describe('preview', () => {
  it('does not cut texts that are only a little longer than the budget', () => {
    expect(preview(['أ'.repeat(900)], 700)).toEqual({ paras: ['أ'.repeat(900)], cut: false });
  });

  it('keeps whole paragraphs up to the budget', () => {
    const ps = ['أ'.repeat(400), 'ب'.repeat(400), 'ج'.repeat(400)];
    expect(preview(ps, 700)).toEqual({ paras: [ps[0]], cut: true });
  });

  it('cuts one huge paragraph at a word boundary', () => {
    const words = Array.from({ length: 400 }, () => 'كلمة').join(' ');
    const r = preview([words], 700);
    expect(r.cut).toBe(true);
    expect(r.paras).toHaveLength(1);
    expect(r.paras[0].endsWith('كلمة…')).toBe(true);
    expect(r.paras[0].length).toBeLessThanOrEqual(701);
  });
});

describe('hifz order', () => {
  it('reveals the next hidden ayah after the last one, wrapping around', () => {
    expect(nextHidden(7, new Set(), 0)).toBe(1);
    expect(nextHidden(7, new Set([1, 2]), 2)).toBe(3);
    expect(nextHidden(7, new Set([5, 6, 7]), 7)).toBe(1);
    expect(nextHidden(7, new Set([2, 4]), 4)).toBe(5);
    expect(nextHidden(3, new Set([1, 2, 3]), 3)).toBe(0);
  });
});

describe('ayah words', () => {
  it('keeps pause signs as separate marks', () => {
    const w = ayahWords('ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى');
    expect(w.map((x) => x.mark)).toEqual([false, false, false, false, true, false, true, false]);
    expect(w[0].t).toBe('ذَٰلِكَ');
  });
});
