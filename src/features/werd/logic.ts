/**
 * Pure helpers for the werd screen: totals, the khatma plan's daily portion and
 * Arabic count wording. No signals here, so everything is easy to test.
 */
import { arNum } from '../../lib/arabic';
import { addDays } from '../../lib/storage';
import { chapters, TOTAL_PAGES, type Chapter } from '../../quran/data';
import type { DayLog, Werd } from '../../state/progress';

export type Plan = NonNullable<Werd['plan']>;

export const GOAL_PRESETS = [1, 2, 5, 10, 20] as const;
export const PLAN_PRESETS = [7, 10, 15, 30, 60, 90] as const;
export const MAX_PLAN_DAYS = 365;

/** Stable identity of a plan, used to count each finished khatma once. */
export function planId(plan: Plan): string {
  return `${plan.start}|${plan.fromPage}|${plan.days}`;
}

export function planTotal(fromPage: number): number {
  return TOTAL_PAGES - fromPage + 1;
}

export function planPace(fromPage: number, days: number): number {
  return Math.max(1, Math.ceil(planTotal(fromPage) / Math.max(1, days)));
}

export function planEnd(plan: Plan): string {
  return addDays(plan.start, plan.days - 1);
}

export interface Totals {
  /** Page reads summed over days (re-reading a page on another day counts). */
  pages: number;
  listenSec: number;
  /** Azkar categories completed, summed over days. */
  azkarDone: number;
  /** Days with at least one azkar category completed. */
  azkarDays: number;
  /** Most pages read in a single day. */
  bestDay: number;
}

export function totals(log: Record<string, DayLog>): Totals {
  const t: Totals = { pages: 0, listenSec: 0, azkarDone: 0, azkarDays: 0, bestDay: 0 };
  for (const d of Object.values(log)) {
    const pages = d?.pages?.length ?? 0;
    const azkar = d?.azkar?.length ?? 0;
    t.pages += pages;
    t.listenSec += d?.listen ?? 0;
    t.azkarDone += azkar;
    if (azkar > 0) t.azkarDays++;
    if (pages > t.bestDay) t.bestDay = pages;
  }
  return t;
}

/** Plan pages (≥ fromPage) read from the plan start up to, but not including, `before`. */
export function planPagesRead(plan: Plan, log: Record<string, DayLog>, before?: string): Set<number> {
  const seen = new Set<number>();
  for (const [k, d] of Object.entries(log)) {
    if (k < plan.start || (before && k >= before)) continue;
    for (const p of d?.pages ?? []) if (p >= plan.fromPage) seen.add(p);
  }
  return seen;
}

/** Surahs that appear (even partly) on pages from..to. */
export function surahsInRange(from: number, to: number): Chapter[] {
  return chapters.filter((c) => c.pages[1] >= from && c.pages[0] <= to);
}

export function surahRangeLabel(list: Chapter[]): string {
  if (!list.length) return '';
  if (list.length === 1) return `سورة ${list[0].ar}`;
  return `من سورة ${list[0].ar} إلى سورة ${list[list.length - 1].ar}`;
}

export interface Portion {
  from: number;
  to: number;
  /** First page of the portion not read yet (null when the portion is done). */
  next: number | null;
  /** Pages of the portion already read. */
  done: number;
  size: number;
  surahs: Chapter[];
}

/**
 * Today's slice of the plan: `size` consecutive pages starting at the first plan
 * page that was not read before today. It stays fixed during the day, so the
 * pages read today fill it up instead of pushing it forward.
 */
export function todayPortion(plan: Plan, log: Record<string, DayLog>, today: string, size: number): Portion | null {
  const before = planPagesRead(plan, log, today);
  let from = plan.fromPage;
  while (from <= TOTAL_PAGES && before.has(from)) from++;
  if (from > TOTAL_PAGES) return null;
  const to = Math.min(TOTAL_PAGES, from + Math.max(1, size) - 1);
  const todayPages = new Set(log[today]?.pages ?? []);
  let done = 0;
  let next: number | null = null;
  for (let p = from; p <= to; p++) {
    if (before.has(p) || todayPages.has(p)) done++;
    else if (next == null) next = p;
  }
  return { from, to, next, done, size: to - from + 1, surahs: surahsInRange(from, to) };
}

/** Pages the plan expects to be read by the end of day `elapsed` (1-based). */
export function expectedBy(plan: Plan, elapsed: number): number {
  const total = planTotal(plan.fromPage);
  if (elapsed <= 0) return 0;
  return Math.min(total, Math.ceil((total / plan.days) * elapsed));
}

export type Pace = { kind: 'ahead' | 'behind' | 'on'; pages: number };

/**
 * Ahead when more than today's expected total is read; behind only for pages
 * missed on previous days (today's portion is not "late" until tomorrow).
 */
export function pace(read: number, expectedToday: number, expectedYesterday: number): Pace {
  if (read > expectedToday) return { kind: 'ahead', pages: read - expectedToday };
  if (read < expectedYesterday) return { kind: 'behind', pages: expectedYesterday - read };
  return { kind: 'on', pages: 0 };
}

/** Day the plan's last page was read, or null if it is not finished. */
export function planFinishDay(plan: Plan, log: Record<string, DayLog>): string | null {
  const total = planTotal(plan.fromPage);
  const seen = new Set<number>();
  for (const k of Object.keys(log).sort()) {
    if (k < plan.start) continue;
    for (const p of log[k]?.pages ?? []) if (p >= plan.fromPage) seen.add(p);
    if (seen.size >= total) return k;
  }
  return null;
}

/* ── Arabic counting ─────────────────────────────────────────────────────── */

function noun(n: number, one: string, two: string, few: string, many: string): string {
  const mod = n % 100;
  if (n === 2) return two;
  if (mod >= 3 && mod <= 10) return few;
  if (n === 0 || n === 1) return one;
  return many;
}

/** Noun that follows a number: ٣ أيام، ١٥ يوماً. */
export const dayWord = (n: number) => noun(n, 'يوم', 'يومان', 'أيام', 'يوماً');
export const pageWord = (n: number) => noun(n, 'صفحة', 'صفحتان', 'صفحات', 'صفحة');

/** "صفحة واحدة"، "صفحتان"، "٥ صفحات"، "٢٠ صفحة" */
export function countPages(n: number): string {
  if (n === 1) return 'صفحة واحدة';
  if (n === 2) return 'صفحتان';
  return `${arNum(n)} ${pageWord(n)}`;
}

export function countDays(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومان';
  return `${arNum(n)} ${dayWord(n)}`;
}

const dateFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

/** 6.4 → "٦٫٤" (drops a trailing ".0"). */
export function arDecimal(n: number, digits = 1): string {
  const s = n.toFixed(digits).replace(/\.0+$/, '');
  return arNum(s).replace('.', '٫');
}

export function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}
