import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toasts: string[] = [];
vi.mock('../../src/ui/toast', () => ({
  toast: (text: string) => void toasts.push(text),
  Toaster: () => null,
}));

import { addDays } from '../../src/lib/storage';
import {
  bestStreak,
  bookmarks,
  log,
  planProgress,
  stats,
  streak,
  today,
  werd,
  werdTarget,
  type DayLog,
} from '../../src/state/progress';
import {
  ACHIEVEMENTS,
  achievementContext,
  evaluate,
  initAchievements,
  khatmaMark,
  newlyUnlocked,
} from '../../src/features/werd/achievements';
import {
  countDays,
  countPages,
  dayWord,
  expectedBy,
  pace,
  planFinishDay,
  planPace,
  surahRangeLabel,
  todayPortion,
  totals,
} from '../../src/features/werd/logic';
import { groupBookmarks, bookmarkHref } from '../../src/features/werd/BookmarksCard';

const T = '2026-11-11';
const day = (offset: number) => addDays(T, offset);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const d = (pages: number[], extra: Partial<DayLog> = {}): DayLog => ({ pages, azkar: [], listen: 0, ...extra });

function reset() {
  today.value = T;
  log.value = {};
  bookmarks.value = [];
  werd.value = { goal: 10, plan: null };
  stats.value = { azkarTotal: 0, tasbeehTotal: 0, surahsListened: 0, khatmas: 0, badges: [] };
  khatmaMark.value = null;
  toasts.length = 0;
}

beforeEach(reset);

describe('werd target and plan math', () => {
  it('uses the daily goal without a plan and the plan pace with one', () => {
    werd.value = { goal: 5, plan: null };
    expect(werdTarget.value).toBe(5);
    werd.value = { goal: 5, plan: { start: T, days: 30, fromPage: 1 } };
    expect(werdTarget.value).toBe(21); // ceil(604 / 30)
    werd.value = { goal: 5, plan: { start: T, days: 7, fromPage: 300 } };
    expect(werdTarget.value).toBe(44); // ceil(305 / 7)
    expect(planPace(300, 7)).toBe(44);
  });

  it('counts unique plan pages read since the start', () => {
    werd.value = { goal: 10, plan: { start: day(-4), days: 30, fromPage: 1 } };
    log.value = {
      [day(-5)]: d(range(1, 10)), // before the plan: ignored
      [day(-3)]: d(range(1, 20)),
      [day(-1)]: d(range(15, 40)), // overlaps: unique pages only
      [day(0)]: d(range(41, 45)),
    };
    const p = planProgress.value!;
    expect(p.read).toBe(45);
    expect(p.total).toBe(604);
    expect(p.day).toBe(5);
    expect(p.days).toBe(30);
    expect(p.expected).toBe(Math.ceil((604 / 30) * 5));
  });

  it("keeps today's portion fixed while pages are read today", () => {
    const plan = { start: day(-2), days: 30, fromPage: 1 };
    const l = { [day(-2)]: d(range(1, 20)), [day(-1)]: d(range(21, 40)), [day(0)]: d(range(41, 45)) };
    const portion = todayPortion(plan, l, T, 21)!;
    expect(portion.from).toBe(41);
    expect(portion.to).toBe(61);
    expect(portion.done).toBe(5);
    expect(portion.next).toBe(46);
    expect(portion.surahs.map((c) => c.id)).toEqual([2, 3]);
    expect(surahRangeLabel(portion.surahs)).toBe('من سورة البقرة إلى سورة آل عمران');
  });

  it('starts the portion at the first gap and clamps it to the last page', () => {
    const plan = { start: day(-1), days: 10, fromPage: 590 };
    const gap = todayPortion(plan, { [day(-1)]: d([590, 591, 593]) }, T, 61)!;
    expect(gap.from).toBe(592);
    expect(gap.to).toBe(604);
    expect(gap.done).toBe(1); // 593 was already read
    const done = todayPortion(plan, { [day(-1)]: d(range(590, 604)) }, T, 2);
    expect(done).toBeNull();
  });

  it('reports ahead / on time / behind against previous days only', () => {
    const plan = { start: day(-4), days: 30, fromPage: 1 };
    const today5 = expectedBy(plan, 5); // 101
    const by4 = expectedBy(plan, 4); // 81
    expect(pace(45, today5, by4)).toEqual({ kind: 'behind', pages: 36 });
    expect(pace(90, today5, by4)).toEqual({ kind: 'on', pages: 0 });
    expect(pace(120, today5, by4)).toEqual({ kind: 'ahead', pages: 19 });
    expect(expectedBy(plan, 0)).toBe(0);
    expect(expectedBy(plan, 40)).toBe(604);
  });

  it('finds the day the plan was finished', () => {
    const plan = { start: day(-3), days: 3, fromPage: 600 };
    const l = { [day(-3)]: d([600, 601]), [day(-2)]: d([602]), [day(-1)]: d([603, 604]), [day(0)]: d([604]) };
    expect(planFinishDay(plan, l)).toBe(day(-1));
    expect(planFinishDay(plan, { [day(-3)]: d([600]) })).toBeNull();
  });
});

describe('streaks from the daily log', () => {
  it('counts consecutive active days and the best run', () => {
    log.value = {
      [day(0)]: d([1]),
      [day(-1)]: d([], { azkar: ['morning'] }),
      [day(-2)]: d([], { listen: 300 }),
      [day(-3)]: d([], { listen: 120 }), // under five minutes: not active
      [day(-4)]: d([2]),
      [day(-5)]: d([3]),
      [day(-6)]: d([4]),
      [day(-7)]: d([5]),
    };
    expect(streak.value).toBe(3);
    expect(bestStreak.value).toBe(4);
  });

  it("keeps yesterday's streak alive before today's first page", () => {
    log.value = { [day(-1)]: d([1]), [day(-2)]: d([2]) };
    expect(streak.value).toBe(2);
    log.value = { [day(-2)]: d([2]) };
    expect(streak.value).toBe(0);
  });
});

describe('Arabic counting', () => {
  it('picks the right noun form', () => {
    expect(countPages(1)).toBe('صفحة واحدة');
    expect(countPages(2)).toBe('صفحتان');
    expect(countPages(5)).toBe('٥ صفحات');
    expect(countPages(11)).toBe('١١ صفحة');
    expect(countPages(103)).toBe('١٠٣ صفحات');
    expect(countDays(30)).toBe('٣٠ يوماً');
    expect(dayWord(7)).toBe('أيام');
  });
});

describe('bookmarks', () => {
  it('groups by label in a fixed order, newest first', () => {
    const groups = groupBookmarks([
      { id: 'a', page: 2, label: 'عام', at: 1 },
      { id: 'b', page: 3, label: 'حفظ', at: 2 },
      { id: 'c', page: 4, label: 'حفظ', at: 5 },
      { id: 'e', page: 6, label: 'خاص', at: 4 },
      { id: 'd', page: 5, label: 'تدبر', at: 3 },
    ]);
    expect(groups.map((g) => g.label)).toEqual(['حفظ', 'تدبر', 'عام', 'خاص']);
    expect(groups[0].items.map((b) => b.id)).toEqual(['c', 'b']);
  });

  it('links to the page and ayah', () => {
    expect(bookmarkHref({ id: 'x', page: 42, key: '2:255', label: 'عام', at: 0 })).toBe('/mushaf/42?k=2:255');
    expect(bookmarkHref({ id: 'y', page: 7, label: 'عام', at: 0 })).toBe('/mushaf/7');
  });
});

describe('achievements', () => {
  let stop: (() => void) | null = null;
  afterEach(() => {
    stop?.();
    stop = null;
  });

  it('has unique ids and sane goals', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) expect(a.goal).toBeGreaterThan(0);
  });

  it('seeds already-earned badges silently on the first run', () => {
    log.value = { [day(-1)]: d(range(1, 60)), [day(0)]: d(range(61, 120)) };
    stop = initAchievements();
    expect(stats.value.badges).toEqual(expect.arrayContaining(['first_page', 'pages_100', 'day_20']));
    expect(toasts).toEqual([]);
  });

  it('toasts each new badge exactly once', () => {
    log.value = { [day(0)]: d([1]) };
    stop = initAchievements();
    expect(toasts).toEqual([]);

    bookmarks.value = [{ id: 'b', page: 1, label: 'عام', at: 1 }];
    expect(toasts).toEqual(['إنجاز جديد: أول علامة']);
    expect(stats.value.badges.filter((b) => b === 'first_bookmark')).toHaveLength(1);

    // Unrelated changes and losing the condition do not re-toast or revoke.
    log.value = { ...log.value, [day(0)]: d([1, 2]) };
    bookmarks.value = [];
    bookmarks.value = [{ id: 'c', page: 2, label: 'عام', at: 2 }];
    expect(toasts).toHaveLength(1);
    expect(stats.value.badges).toContain('first_bookmark');
  });

  it('is idempotent when started twice', () => {
    stop = initAchievements();
    expect(initAchievements()).toBe(stop);
    bookmarks.value = [{ id: 'b', page: 1, label: 'عام', at: 1 }];
    expect(toasts).toHaveLength(1);
  });

  it('counts a finished khatma once and unlocks its badge', () => {
    werd.value = { goal: 10, plan: { start: T, days: 3, fromPage: 600 } };
    log.value = { [day(0)]: d([600, 601, 602, 603]) };
    stop = initAchievements();
    expect(stats.value.khatmas).toBe(0);

    log.value = { [day(0)]: d([600, 601, 602, 603, 604]) };
    expect(stats.value.khatmas).toBe(1);
    expect(toasts.some((t) => t.startsWith('مبارك'))).toBe(true);
    expect(toasts).toContain('إنجاز جديد: الختمة الأولى');

    const before = toasts.length;
    log.value = { ...log.value, [day(0)]: d([...range(600, 604), 1]) };
    expect(stats.value.khatmas).toBe(1);
    expect(toasts).toHaveLength(before);
  });

  it('counts a khatma finished before start-up without a toast', () => {
    werd.value = { goal: 10, plan: { start: day(-1), days: 3, fromPage: 600 } };
    log.value = { [day(-1)]: d(range(600, 604)) };
    stop = initAchievements();
    expect(stats.value.khatmas).toBe(1);
    expect(stats.value.badges).toContain('khatma_1');
    expect(toasts).toEqual([]);
  });

  it('reports progress and keeps migrated v3 badges', () => {
    stats.value = { ...stats.value, azkarTotal: 40, badges: ['streak_7'] };
    const ctx = achievementContext();
    const byId = Object.fromEntries(evaluate(ctx).map((s) => [s.a.id, s]));
    expect(byId.azkar_100.value).toBe(40);
    expect(byId.azkar_100.unlocked).toBe(false);
    expect(byId.streak_7.unlocked).toBe(true);
    expect(newlyUnlocked(ctx, ctx.stats.badges)).toEqual([]);
  });

  it('measures listening in whole minutes', () => {
    log.value = { [day(-1)]: d([], { listen: 1800 }), [day(0)]: d([], { listen: 1830 }) };
    expect(totals(log.value).listenSec).toBe(3630);
    const listen = evaluate(achievementContext()).find((s) => s.a.id === 'listen_hour')!;
    expect(listen.value).toBe(60);
    expect(listen.unlocked).toBe(true);
  });
});
