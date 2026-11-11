import { beforeEach, describe, expect, it } from 'vitest';
import data from '../../src/data/azkar.json';
import {
  AZKAR_META,
  type AzkarDay,
  applyReset,
  applyTap,
  applyUndo,
  azkarStore,
  azkarSummary,
  azkarToday,
  emptyDay,
  forDay,
  nextUnfinished,
  progressOf,
  resetAzkar,
  suggestedCategory,
  tapZekr,
  undoZekr,
} from '../../src/features/azkar/azkar-state';
import { log, stats, today } from '../../src/state/progress';

const DAY = '2026-11-11';
const NEXT_DAY = '2026-11-12';

function at(h: number, m = 0) {
  return new Date(2026, 10, 11, h, m);
}

describe('azkar metadata', () => {
  it('mirrors azkar.json (ids, titles, short names and repetition targets)', () => {
    const fromJson = (data as { categories: { id: string; title: string; short: string; items: { count: number }[] }[] }).categories.map(
      (c) => ({ id: c.id, title: c.title, short: c.short, targets: c.items.map((i) => i.count) }),
    );
    expect(AZKAR_META).toEqual(fromJson);
  });

  it('has no doubled harakat, tatweel or Latin commas left in the texts', () => {
    for (const c of data.categories) {
      for (const item of c.items) {
        expect(item.text).not.toMatch(/[ً-ِْ]{2}/);
        expect(item.text).not.toMatch(/ـ/);
        expect(item.text).not.toContain(',');
        expect(item.text).not.toMatch(/عوذُبِ/);
      }
    }
  });
});

describe('suggestedCategory', () => {
  it('is morning from 04:00 to 14:59 and evening otherwise', () => {
    expect(suggestedCategory(at(3, 59))).toBe('evening');
    expect(suggestedCategory(at(4, 0))).toBe('morning');
    expect(suggestedCategory(at(14, 59))).toBe('morning');
    expect(suggestedCategory(at(15, 0))).toBe('evening');
    expect(suggestedCategory(at(23, 30))).toBe('evening');
    expect(suggestedCategory(at(0, 10))).toBe('evening');
  });
});

describe('progress logic', () => {
  const targets = [1, 3, 2];

  it('counts done items and capped repetitions', () => {
    expect(progressOf(undefined, targets)).toEqual({ done: 0, total: 3, reps: 0, repsTotal: 6, complete: false });
    expect(progressOf([1, 2, 5], targets)).toEqual({ done: 2, total: 3, reps: 5, repsTotal: 6, complete: false });
    expect(progressOf([1, 3, 2], targets).complete).toBe(true);
  });

  it('applies taps, never counts past the target and reports item completion', () => {
    let s = emptyDay(DAY);
    let r = applyTap(s, 'x', 1, targets);
    expect(r).toMatchObject({ counted: true, remaining: 2, itemDone: false, credit: false, categoryDone: false });
    s = r.state;
    s = applyTap(s, 'x', 1, targets).state;
    r = applyTap(s, 'x', 1, targets);
    expect(r).toMatchObject({ counted: true, remaining: 0, itemDone: true, credit: true });
    s = r.state;
    expect(s.counts.x).toEqual([0, 3, 0]);
    expect(s.credited.x).toEqual([1]);

    const again = applyTap(s, 'x', 1, targets);
    expect(again.counted).toBe(false);
    expect(again.state).toBe(s);
  });

  it('does not mutate the previous state', () => {
    const s = emptyDay(DAY);
    const r = applyTap(s, 'x', 0, targets);
    expect(s.counts).toEqual({});
    expect(r.state).not.toBe(s);
  });

  it('flags the category done only on the tap that finishes the last item', () => {
    let s = emptyDay(DAY);
    const done: boolean[] = [];
    for (const i of [0, 1, 1, 1, 2, 2]) {
      const r = applyTap(s, 'x', i, targets);
      done.push(r.categoryDone);
      s = r.state;
    }
    expect(done).toEqual([false, false, false, false, false, true]);
    expect(applyTap(s, 'x', 2, targets).categoryDone).toBe(false);
  });

  it('finds the next unfinished item, wrapping to the start', () => {
    expect(nextUnfinished([1, 0, 0], targets, 0)).toBe(1);
    expect(nextUnfinished([0, 3, 2], targets, 2)).toBe(0);
    expect(nextUnfinished([1, 3, 0], targets, 1)).toBe(2);
    expect(nextUnfinished([1, 3, 2], targets, 0)).toBe(-1);
  });

  it('undo takes one repetition back but keeps the credit', () => {
    let s = applyTap(emptyDay(DAY), 'x', 0, targets).state;
    s = applyUndo(s, 'x', 0);
    expect(s.counts.x[0]).toBe(0);
    expect(s.credited.x).toEqual([0]);
    expect(applyUndo(s, 'x', 0)).toBe(s);
  });

  it('reset clears one category and keeps credits and other categories', () => {
    let s = applyTap(emptyDay(DAY), 'x', 0, targets).state;
    s = applyTap(s, 'y', 0, targets).state;
    s = applyReset(s, 'x');
    expect(s.counts.x).toBeUndefined();
    expect(s.counts.y).toEqual([1, 0, 0]);
    expect(s.credited.x).toEqual([0]);
  });
});

describe('day reset', () => {
  it('starts a fresh day when the stored day is stale or the data is corrupt', () => {
    const s: AzkarDay = { day: DAY, counts: { morning: [1] }, credited: { morning: [0] } };
    expect(forDay(s, DAY)).toBe(s);
    expect(forDay(s, NEXT_DAY)).toEqual(emptyDay(NEXT_DAY));
    expect(forDay(null, DAY)).toEqual(emptyDay(DAY));
    expect(forDay({ day: DAY } as AzkarDay, DAY)).toEqual(emptyDay(DAY));
  });
});

describe('azkar signals', () => {
  const wakeup = AZKAR_META.find((m) => m.id === 'wakeup')!;

  beforeEach(() => {
    today.value = DAY;
    azkarStore.value = emptyDay('');
    log.value = {};
    stats.value = { azkarTotal: 0, tasbeehTotal: 0, surahsListened: 0, khatmas: 0, badges: [] };
  });

  it('summarises progress for the Home screen', () => {
    expect(azkarSummary('wakeup')).toEqual({ done: 0, total: 3, complete: false });
    tapZekr('wakeup', 0, wakeup.targets);
    expect(azkarSummary('wakeup')).toEqual({ done: 1, total: 3, complete: false });
    expect(azkarSummary('nope')).toEqual({ done: 0, total: 0, complete: false });
  });

  it('persists per day and resets automatically on a new day', () => {
    tapZekr('wakeup', 0, wakeup.targets);
    expect(azkarStore.value.day).toBe(DAY);
    expect(JSON.parse(localStorage.getItem('taratil:azkar:day')!).counts.wakeup[0]).toBe(1);

    today.value = NEXT_DAY;
    expect(azkarSummary('wakeup').done).toBe(0);
    expect(azkarToday.value.counts).toEqual({});

    tapZekr('wakeup', 1, wakeup.targets);
    expect(azkarStore.value.day).toBe(NEXT_DAY);
    expect(azkarStore.value.counts.wakeup).toEqual([0, 1, 0]);
  });

  it('marks the category done once and credits each finished item once', () => {
    const results = wakeup.targets.map((_, i) => tapZekr('wakeup', i, wakeup.targets));
    expect(results.map((r) => r.categoryDone)).toEqual([false, false, true]);
    expect(log.value[DAY].azkar).toEqual(['wakeup']);
    expect(stats.value.azkarTotal).toBe(3);

    // Tapping a finished item does nothing.
    expect(tapZekr('wakeup', 0, wakeup.targets).counted).toBe(false);
    expect(stats.value.azkarTotal).toBe(3);

    // Reset and read again: no double credit, no duplicate log entry.
    resetAzkar('wakeup');
    expect(azkarSummary('wakeup').done).toBe(0);
    wakeup.targets.forEach((_, i) => tapZekr('wakeup', i, wakeup.targets));
    expect(azkarSummary('wakeup').complete).toBe(true);
    expect(stats.value.azkarTotal).toBe(3);
    expect(log.value[DAY].azkar).toEqual(['wakeup']);

    // Undo + re-finish an item: still no extra credit.
    undoZekr('wakeup', 2);
    expect(azkarSummary('wakeup').complete).toBe(false);
    tapZekr('wakeup', 2, wakeup.targets);
    expect(stats.value.azkarTotal).toBe(3);
  });

  it('credits again on a new day', () => {
    tapZekr('wakeup', 0, wakeup.targets);
    today.value = NEXT_DAY;
    tapZekr('wakeup', 0, wakeup.targets);
    expect(stats.value.azkarTotal).toBe(2);
  });

  it('does not credit or complete a multi-count item until its last repetition', () => {
    const post = AZKAR_META.find((m) => m.id === 'post_prayer')!;
    const i = post.targets.indexOf(33);
    for (let k = 0; k < 32; k++) tapZekr('post_prayer', i, post.targets);
    expect(stats.value.azkarTotal).toBe(0);
    const last = tapZekr('post_prayer', i, post.targets);
    expect(last).toMatchObject({ itemDone: true, credit: true, remaining: 0 });
    expect(stats.value.azkarTotal).toBe(1);
  });
});
