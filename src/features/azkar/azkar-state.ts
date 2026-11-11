/**
 * Azkar progress for the current day.
 *
 * Kept free of the 50 KB azkar.json so the Home screen can import the summary
 * without pulling the texts into its chunk. `AZKAR_META` mirrors the JSON
 * (ids, titles and repetition targets); a unit test keeps the two in sync.
 */
import { computed } from '@preact/signals';
import { persisted } from '../../lib/storage';
import { bumpStat, markAzkarDone, today } from '../../state/progress';

export interface AzkarMeta {
  id: string;
  title: string;
  short: string;
  /** Repetitions required for each item, in order. */
  targets: number[];
}

export const AZKAR_META: AzkarMeta[] = [
  { id: 'morning', title: 'أذكار الصباح', short: 'الصباح', targets: [1, 3, 3, 3, 1, 1, 3, 4, 7, 3, 1, 1, 3, 3, 3, 1, 3, 1, 1, 3, 10, 3, 3, 3, 3, 1, 100, 100, 100] },
  { id: 'evening', title: 'أذكار المساء', short: 'المساء', targets: [1, 1, 3, 3, 3, 1, 1, 3, 4, 1, 7, 3, 1, 1, 3, 3, 3, 1, 3, 1, 1, 3, 10, 3, 3, 3, 3, 100, 1, 100] },
  { id: 'post_prayer', title: 'أذكار بعد الصلاة', short: 'بعد الصلاة', targets: [1, 1, 1, 33, 1, 10, 1, 7, 1] },
  { id: 'sleep', title: 'أذكار النوم', short: 'النوم', targets: [1, 1, 3, 1, 1, 1, 1, 33, 33, 34] },
  { id: 'wakeup', title: 'أذكار الاستيقاظ', short: 'الاستيقاظ', targets: [1, 1, 1] },
  { id: 'general', title: 'تسابيح وأذكار عامة', short: 'تسابيح', targets: Array(16).fill(100) },
  { id: 'quranic', title: 'أدعية قرآنية', short: 'أدعية قرآنية', targets: Array(26).fill(1) },
  { id: 'prophets', title: 'أدعية الأنبياء', short: 'أدعية الأنبياء', targets: Array(13).fill(1) },
];

const META_BY_ID = new Map(AZKAR_META.map((m) => [m.id, m]));

export function azkarMeta(id: string | undefined): AzkarMeta | undefined {
  return id ? META_BY_ID.get(id) : undefined;
}

/** Morning azkar from 04:00 to 14:59, evening azkar otherwise. */
export function suggestedCategory(now: Date = new Date()): 'morning' | 'evening' {
  const h = now.getHours();
  return h >= 4 && h < 15 ? 'morning' : 'evening';
}

// ── Pure state logic (unit-tested) ─────────────────────────────────────────

export interface AzkarDay {
  /** Local day key (YYYY-MM-DD) the counts belong to. */
  day: string;
  /** Repetitions done per item index, per category. */
  counts: Record<string, number[]>;
  /** Items already credited to the lifetime stat today, so reset + re-count never double counts. */
  credited: Record<string, number[]>;
}

export const emptyDay = (day: string): AzkarDay => ({ day, counts: {}, credited: {} });

function isDay(s: unknown): s is AzkarDay {
  const d = s as AzkarDay | null;
  return !!d && typeof d.day === 'string' && typeof d.counts === 'object' && !!d.counts && typeof d.credited === 'object' && !!d.credited;
}

/** The stored state if it belongs to `day`, otherwise a fresh day. */
export function forDay(s: AzkarDay | null | undefined, day: string): AzkarDay {
  return isDay(s) && s.day === day ? s : emptyDay(day);
}

export function itemCount(counts: readonly number[] | undefined, index: number): number {
  const n = counts?.[index];
  return typeof n === 'number' && n > 0 ? n : 0;
}

export interface Progress {
  /** Items fully done. */
  done: number;
  /** Number of items. */
  total: number;
  /** Repetitions done across all items (capped per item). */
  reps: number;
  repsTotal: number;
  complete: boolean;
}

export function progressOf(counts: readonly number[] | undefined, targets: readonly number[]): Progress {
  let done = 0;
  let reps = 0;
  let repsTotal = 0;
  targets.forEach((t, i) => {
    const c = Math.min(itemCount(counts, i), t);
    reps += c;
    repsTotal += t;
    if (c >= t) done++;
  });
  return { done, total: targets.length, reps, repsTotal, complete: targets.length > 0 && done === targets.length };
}

/** First unfinished item after `from`, wrapping to the start; -1 when everything is done. */
export function nextUnfinished(counts: readonly number[] | undefined, targets: readonly number[], from: number): number {
  const n = targets.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (itemCount(counts, i) < targets[i]) return i;
  }
  return -1;
}

export interface TapResult {
  state: AzkarDay;
  /** A repetition was counted (false when the item was already done). */
  counted: boolean;
  /** Repetitions still to go on this item. */
  remaining: number;
  /** This tap finished the item. */
  itemDone: boolean;
  /** First time today this item was finished: credit the lifetime stat. */
  credit: boolean;
  /** This tap finished the whole category. */
  categoryDone: boolean;
}

export function applyTap(s: AzkarDay, cat: string, index: number, targets: readonly number[]): TapResult {
  const target = targets[index];
  const counts = s.counts[cat];
  const cur = itemCount(counts, index);
  if (target == null || cur >= target) {
    return { state: s, counted: false, remaining: 0, itemDone: false, credit: false, categoryDone: false };
  }
  const next = targets.map((_, i) => itemCount(counts, i));
  next[index] = cur + 1;
  const itemDone = next[index] >= target;
  const credited = s.credited[cat] ?? [];
  const credit = itemDone && !credited.includes(index);
  return {
    state: {
      ...s,
      counts: { ...s.counts, [cat]: next },
      credited: credit ? { ...s.credited, [cat]: [...credited, index] } : s.credited,
    },
    counted: true,
    remaining: target - next[index],
    itemDone,
    credit,
    categoryDone: itemDone && progressOf(next, targets).complete,
  };
}

/** Takes back one repetition (a mis-tap). Credits are kept so re-finishing never double counts. */
export function applyUndo(s: AzkarDay, cat: string, index: number): AzkarDay {
  const counts = s.counts[cat];
  const cur = itemCount(counts, index);
  if (!cur) return s;
  const next = (counts ?? []).slice();
  next[index] = cur - 1;
  return { ...s, counts: { ...s.counts, [cat]: next } };
}

export function applyReset(s: AzkarDay, cat: string): AzkarDay {
  if (!(cat in s.counts)) return s;
  const counts = { ...s.counts };
  delete counts[cat];
  return { ...s, counts };
}

// ── Signals ────────────────────────────────────────────────────────────────

export const azkarStore = persisted<AzkarDay>('azkar:day', emptyDay(''));

/** Today's state; rolls over automatically when the `today` signal changes. */
export const azkarToday = computed(() => forDay(azkarStore.value, today.value));

export function tapZekr(cat: string, index: number, targets: readonly number[]): TapResult {
  const r = applyTap(azkarToday.value, cat, index, targets);
  if (!r.counted) return r;
  azkarStore.value = r.state;
  if (r.credit) bumpStat('azkarTotal');
  if (r.categoryDone) markAzkarDone(cat);
  return r;
}

export function undoZekr(cat: string, index: number): void {
  const cur = azkarToday.value;
  const next = applyUndo(cur, cat, index);
  if (next !== cur) azkarStore.value = next;
}

export function resetAzkar(cat: string): void {
  const cur = azkarToday.value;
  const next = applyReset(cur, cat);
  if (next !== cur || azkarStore.value.day !== cur.day) azkarStore.value = next;
}

/**
 * Today's progress for a category, e.g. for the Home screen:
 * `azkarSummary(suggestedCategory())` → { done: 5, total: 29, complete: false }.
 * Reading it inside a component subscribes that component to changes.
 */
export function azkarSummary(cat: string): { done: number; total: number; complete: boolean } {
  const meta = azkarMeta(cat);
  if (!meta) return { done: 0, total: 0, complete: false };
  const p = progressOf(azkarToday.value.counts[cat], meta.targets);
  return { done: p.done, total: p.total, complete: p.complete };
}
