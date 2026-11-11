/**
 * Badges earned from real activity (pages read, azkar, listening…).
 * `initAchievements()` watches the progress signals and records new badges in
 * stats.badges with a toast. Badges already deserved when it starts are
 * recorded silently, so opening the app never replays old toasts.
 */
import { effect, untracked } from '@preact/signals';
import { persisted } from '../../lib/storage';
import {
  bestStreak,
  bookmarks,
  bumpStat,
  log,
  planProgress,
  stats,
  werd,
  type Bookmark,
  type Stats,
} from '../../state/progress';
import type { IconName } from '../../ui/Icon';
import { toast } from '../../ui/toast';
import { planId, totals, type Totals } from './logic';

export interface AchievementContext {
  stats: Stats;
  totals: Totals;
  bestStreak: number;
  bookmarks: Bookmark[];
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  /** Value needed to unlock. */
  goal: number;
  /** Optional unit shown with the progress, e.g. "دقيقة". */
  unit?: string;
  value: (c: AchievementContext) => number;
}

const pages = (c: AchievementContext) => c.totals.pages;

// Ids streak_7, streak_30 and azkar_100 match Taratil v3 so migrated badges stay earned.
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_page', title: 'البداية المباركة', desc: 'اقرأ أول صفحة في المصحف', icon: 'book', goal: 1, value: pages },
  { id: 'pages_100', title: 'مئة صفحة', desc: 'اقرأ ١٠٠ صفحة من المصحف', icon: 'layers', goal: 100, value: pages },
  { id: 'pages_1000', title: 'ألف صفحة', desc: 'اقرأ ١٠٠٠ صفحة من المصحف', icon: 'library', goal: 1000, value: pages },
  {
    id: 'day_20',
    title: 'همّة عالية',
    desc: 'اقرأ ٢٠ صفحة في يوم واحد',
    icon: 'zap',
    goal: 20,
    value: (c) => c.totals.bestDay,
  },
  {
    id: 'streak_7',
    title: 'مواظب',
    desc: 'حافظ على نشاطك ٧ أيام متتالية',
    icon: 'flame',
    goal: 7,
    value: (c) => c.bestStreak,
  },
  {
    id: 'streak_30',
    title: 'صديق القرآن',
    desc: 'حافظ على نشاطك ٣٠ يوماً متتالياً',
    icon: 'calendar',
    goal: 30,
    value: (c) => c.bestStreak,
  },
  {
    id: 'khatma_1',
    title: 'الختمة الأولى',
    desc: 'أتمّ خطة ختمة كاملة',
    icon: 'award',
    goal: 1,
    value: (c) => c.stats.khatmas,
  },
  {
    id: 'azkar_100',
    title: 'ذاكر لله',
    desc: 'اقرأ ١٠٠ ذكر',
    icon: 'sun',
    goal: 100,
    value: (c) => c.stats.azkarTotal,
  },
  {
    id: 'azkar_1000',
    title: 'لسان رطب بذكر الله',
    desc: 'اقرأ ١٠٠٠ ذكر',
    icon: 'star',
    goal: 1000,
    value: (c) => c.stats.azkarTotal,
  },
  {
    id: 'azkar_days_7',
    title: 'حصن يومي',
    desc: 'أتمّ الأذكار في ٧ أيام مختلفة',
    icon: 'moon',
    goal: 7,
    value: (c) => c.totals.azkarDays,
  },
  {
    id: 'tasbeeh_1000',
    title: 'ألف تسبيحة',
    desc: 'سبّح ١٠٠٠ مرة بالسبحة',
    icon: 'beads',
    goal: 1000,
    value: (c) => c.stats.tasbeehTotal,
  },
  {
    id: 'surahs_10',
    title: 'مستمع منصت',
    desc: 'استمع إلى ١٠ سور كاملة',
    icon: 'headphones',
    goal: 10,
    value: (c) => c.stats.surahsListened,
  },
  {
    id: 'listen_hour',
    title: 'ساعة مع القرآن',
    desc: 'استمع إلى القرآن ساعة كاملة إجمالاً',
    icon: 'clock',
    goal: 60,
    unit: 'دقيقة',
    value: (c) => Math.floor(c.totals.listenSec / 60),
  },
  {
    id: 'first_bookmark',
    title: 'أول علامة',
    desc: 'احفظ موضعاً في المصحف بعلامة',
    icon: 'bookmark',
    goal: 1,
    value: (c) => c.bookmarks.length,
  },
];

/** Reads the progress signals (so an effect calling it re-runs on change). */
export function achievementContext(): AchievementContext {
  return {
    stats: stats.value,
    totals: totals(log.value),
    bestStreak: bestStreak.value,
    bookmarks: bookmarks.value,
  };
}

export interface AchievementState {
  a: Achievement;
  value: number;
  unlocked: boolean;
}

export function evaluate(ctx: AchievementContext, earned: readonly string[] = ctx.stats.badges): AchievementState[] {
  return ACHIEVEMENTS.map((a) => {
    const value = a.value(ctx);
    return { a, value, unlocked: earned.includes(a.id) || value >= a.goal };
  });
}

/** Achievements whose condition is met but that are not in `earned` yet. */
export function newlyUnlocked(ctx: AchievementContext, earned: readonly string[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !earned.includes(a.id) && a.value(ctx) >= a.goal);
}

/* ── Khatma completion ───────────────────────────────────────────────────── */

/** Id of the last plan whose completion was counted in stats.khatmas. */
export const khatmaMark = persisted<string | null>('werd:khatma', null);

/** True when the active plan has every page read. */
export function planComplete(): boolean {
  const p = planProgress.value;
  return !!p && p.read >= p.total;
}

/** Counts a finished plan once (bumpStat('khatmas')). Returns true when it did. */
export function settleKhatma(announce = true): boolean {
  const plan = werd.value.plan;
  if (!plan || !planComplete()) return false;
  const id = planId(plan);
  if (untracked(() => khatmaMark.value) === id) return false;
  untracked(() => {
    khatmaMark.value = id;
    bumpStat('khatmas');
  });
  if (announce) toast('مبارك! أتممت ختمة كاملة، تقبّل الله منك', undefined, 4000);
  return true;
}

/* ── Watcher ─────────────────────────────────────────────────────────────── */

let dispose: (() => void) | null = null;

/**
 * Starts the badge + khatma watcher (idempotent). Returns a function that
 * stops it. The first run records what is already earned without toasts.
 */
export function initAchievements(): () => void {
  if (dispose) return dispose;
  let khatmaSeeded = false;
  const stopKhatma = effect(() => {
    settleKhatma(khatmaSeeded);
    khatmaSeeded = true;
  });

  let seeded = false;
  const stopBadges = effect(() => {
    const ctx = achievementContext();
    const fresh = newlyUnlocked(ctx, ctx.stats.badges);
    if (fresh.length) {
      untracked(() => {
        stats.value = { ...stats.value, badges: [...stats.value.badges, ...fresh.map((a) => a.id)] };
      });
      if (seeded) for (const a of fresh) toast(`إنجاز جديد: ${a.title}`, undefined, 3600);
    }
    seeded = true;
  });

  dispose = () => {
    stopKhatma();
    stopBadges();
    dispose = null;
  };
  return dispose;
}
