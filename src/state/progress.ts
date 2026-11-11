import { computed, signal } from '@preact/signals';
import { addDays, dayKey, persisted } from '../lib/storage';

/** What the user did on a given day. Drives werd, streaks, charts and badges. */
export interface DayLog {
  /** Mushaf pages actually read (stayed on the page long enough). */
  pages: number[];
  /** Azkar categories completed. */
  azkar: string[];
  /** Seconds of Quran listening. */
  listen: number;
}

export interface Bookmark {
  id: string;
  page: number;
  /** Optional ayah, "2:255". */
  key?: string;
  label: string;
  at: number;
}

export interface Werd {
  /** Daily goal in pages. */
  goal: number;
  /** Optional khatma plan. */
  plan: null | { start: string; days: number; fromPage: number };
}

export interface Stats {
  azkarTotal: number;
  tasbeehTotal: number;
  surahsListened: number;
  khatmas: number;
  badges: string[];
}

export const today = signal(dayKey());
// Roll the day over while the app stays open (e.g. reading past midnight).
setInterval(() => {
  const k = dayKey();
  if (k !== today.value) today.value = k;
}, 30_000);

export const log = persisted<Record<string, DayLog>>('log', {});
export const lastRead = persisted<{ page: number; at: number }>('lastRead', { page: 1, at: 0 });
export const bookmarks = persisted<Bookmark[]>('bookmarks', []);
export const werd = persisted<Werd>('werd', { goal: 10, plan: null });
export const stats = persisted<Stats>('stats', {
  azkarTotal: 0,
  tasbeehTotal: 0,
  surahsListened: 0,
  khatmas: 0,
  badges: [],
});

const EMPTY: DayLog = { pages: [], azkar: [], listen: 0 };

export function dayLog(key = today.value): DayLog {
  return { ...EMPTY, ...log.value[key] };
}

function updateDay(fn: (d: DayLog) => DayLog, key = today.value) {
  const next = { ...log.value, [key]: fn(dayLog(key)) };
  // Keep a little over a year of history.
  const keys = Object.keys(next).sort();
  if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete next[k];
  log.value = next;
}

export function markPageRead(page: number): void {
  if (dayLog().pages.includes(page)) return;
  updateDay((d) => ({ ...d, pages: [...d.pages, page] }));
}

export function markAzkarDone(category: string): void {
  if (dayLog().azkar.includes(category)) return;
  updateDay((d) => ({ ...d, azkar: [...d.azkar, category] }));
}

export function addListenSeconds(sec: number): void {
  if (sec <= 0) return;
  updateDay((d) => ({ ...d, listen: d.listen + sec }));
}

export function bumpStat(key: 'azkarTotal' | 'tasbeehTotal' | 'surahsListened' | 'khatmas', by = 1): void {
  stats.value = { ...stats.value, [key]: stats.value[key] + by };
}

export const todayLog = computed(() => {
  void log.value;
  return dayLog(today.value);
});

const active = (d?: DayLog) => !!d && (d.pages.length > 0 || d.azkar.length > 0 || d.listen >= 300);

/** Consecutive active days ending today (or yesterday, if today has no activity yet). */
export const streak = computed(() => {
  const l = log.value;
  let k = today.value;
  if (!active(l[k])) k = addDays(k, -1);
  let n = 0;
  while (active(l[k])) {
    n++;
    k = addDays(k, -1);
  }
  return n;
});

export const bestStreak = computed(() => {
  const days = Object.keys(log.value).filter((k) => active(log.value[k])).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const k of days) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
});

/** Pages read per day for the last `n` days (oldest first). */
export function lastDays(n: number): { key: string; pages: number }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(today.value, -i);
    out.push({ key, pages: log.value[key]?.pages.length ?? 0 });
  }
  return out;
}

/** Today's werd target: plan pace if a khatma plan is active, otherwise the daily goal. */
export const werdTarget = computed(() => {
  const w = werd.value;
  if (!w.plan) return w.goal;
  const total = 604 - w.plan.fromPage + 1;
  return Math.max(1, Math.ceil(total / w.plan.days));
});

/** Unique pages read since the plan started. */
export const planProgress = computed(() => {
  const plan = werd.value.plan;
  if (!plan) return null;
  const seen = new Set<number>();
  for (const [k, d] of Object.entries(log.value)) {
    if (k >= plan.start) for (const p of d.pages) if (p >= plan.fromPage) seen.add(p);
  }
  const total = 604 - plan.fromPage + 1;
  const elapsed = Math.max(1, daysBetween(plan.start, today.value) + 1);
  return {
    read: seen.size,
    total,
    day: Math.min(elapsed, plan.days),
    days: plan.days,
    expected: Math.min(total, Math.ceil((total / plan.days) * elapsed)),
  };
});

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
