/**
 * Tasbeeh counter state. Taps only touch in-memory signals; storage writes and
 * the lifetime stat are flushed in batches so rapid tapping never stutters.
 */
import { computed, signal } from '@preact/signals';
import { read, write } from '../../lib/storage';
import { bumpStat, stats, today } from '../../state/progress';

export type Mode = 'free' | 'guided';
/** 0 = open (no target). */
export type Target = 0 | 33 | 100 | 1000;
export const TARGETS: Target[] = [33, 100, 1000, 0];

export interface Preset {
  id: string;
  /** Short chip label. */
  label: string;
  /** Text with tashkeel, shown above the counter. */
  text: string;
}

export const PRESETS: Preset[] = [
  { id: 'subhan', label: 'سبحان الله', text: 'سُبْحَانَ اللَّهِ' },
  { id: 'hamd', label: 'الحمد لله', text: 'الْحَمْدُ لِلَّهِ' },
  { id: 'takbir', label: 'الله أكبر', text: 'اللَّهُ أَكْبَرُ' },
  { id: 'tahlil', label: 'لا إله إلا الله', text: 'لَا إِلَهَ إِلَّا اللَّهُ' },
  { id: 'istighfar', label: 'أستغفر الله', text: 'أَسْتَغْفِرُ اللَّهَ' },
  { id: 'subhan-bihamdih', label: 'سبحان الله وبحمده', text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ' },
  { id: 'hawqala', label: 'لا حول ولا قوة إلا بالله', text: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ' },
  { id: 'salat', label: 'اللهم صلِّ على محمد', text: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ' },
];

/** تسبيح ما بعد الصلاة — صحيح مسلم (٥٩٧). */
export const GUIDED_STEPS: { text: string; label: string; count: number }[] = [
  { label: 'سبحان الله', text: 'سُبْحَانَ اللَّهِ', count: 33 },
  { label: 'الحمد لله', text: 'الْحَمْدُ لِلَّهِ', count: 33 },
  { label: 'الله أكبر', text: 'اللَّهُ أَكْبَرُ', count: 33 },
  {
    label: 'تمام المئة',
    text: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    count: 1,
  },
];
export const GUIDED_TOTAL = GUIDED_STEPS.reduce((n, s) => n + s.count, 0);

export interface Config {
  mode: Mode;
  /** Preset id, or 'custom'. */
  preset: string;
  custom: string;
  target: Target;
}

export const DEFAULT_CONFIG: Config = { mode: 'free', preset: 'subhan', custom: '', target: 33 };

// ── Pure logic (unit-tested) ───────────────────────────────────────────────

export interface GuidedPosition {
  step: number;
  /** Taps done inside the current step. */
  inStep: number;
  stepCount: number;
  done: boolean;
}

export function guidedPosition(count: number): GuidedPosition {
  let left = Math.max(0, count);
  for (let step = 0; step < GUIDED_STEPS.length; step++) {
    const n = GUIDED_STEPS[step].count;
    if (left < n) return { step, inStep: left, stepCount: n, done: false };
    left -= n;
  }
  const last = GUIDED_STEPS.length - 1;
  return { step: last, inStep: GUIDED_STEPS[last].count, stepCount: GUIDED_STEPS[last].count, done: true };
}

/** Ring fill (0–1) for the current round or step. */
export function ringFraction(cfg: Config, count: number): number {
  if (cfg.mode === 'guided') {
    const g = guidedPosition(count);
    return g.done ? 1 : g.inStep / g.stepCount;
  }
  if (!cfg.target) return 0;
  if (count > 0 && count % cfg.target === 0) return 1;
  return (count % cfg.target) / cfg.target;
}

export type TapKind = 'ignored' | 'tap' | 'target' | 'step' | 'complete';

/** What a tap that brings the counter to `next` means (for haptics and announcements). */
export function classifyTap(cfg: Config, next: number): TapKind {
  if (cfg.mode === 'guided') {
    if (next > GUIDED_TOTAL) return 'ignored';
    if (next === GUIDED_TOTAL) return 'complete';
    const g = guidedPosition(next);
    return g.inStep === 0 ? 'step' : 'tap';
  }
  return cfg.target && next % cfg.target === 0 ? 'target' : 'tap';
}

export function dhikrText(cfg: Config, count: number): string {
  if (cfg.mode === 'guided') return GUIDED_STEPS[guidedPosition(count).step].text;
  if (cfg.preset === 'custom' && cfg.custom.trim()) return cfg.custom.trim();
  return (PRESETS.find((p) => p.id === cfg.preset) ?? PRESETS[0]).text;
}

function sanitizeConfig(c: Partial<Config> | null | undefined): Config {
  const cfg = { ...DEFAULT_CONFIG, ...(c && typeof c === 'object' ? c : {}) };
  if (cfg.mode !== 'free' && cfg.mode !== 'guided') cfg.mode = 'free';
  if (!TARGETS.includes(cfg.target)) cfg.target = 33;
  if (typeof cfg.custom !== 'string') cfg.custom = '';
  if (cfg.preset !== 'custom' && !PRESETS.some((p) => p.id === cfg.preset)) cfg.preset = 'subhan';
  if (cfg.preset === 'custom' && !cfg.custom.trim()) cfg.preset = 'subhan';
  return cfg;
}

const sanitizeCount = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

// ── Signals ────────────────────────────────────────────────────────────────

interface Saved {
  config: Config;
  count: number;
}

const saved = read<Partial<Saved>>('tasbeeh:session', {});
const savedToday = read<{ day: string; count: number }>('tasbeeh:today', { day: '', count: 0 });

export const config = signal<Config>(sanitizeConfig(saved.config));
/** Taps in the current session. */
export const count = signal(sanitizeCount(saved.count));
const todayStore = signal({ day: typeof savedToday.day === 'string' ? savedToday.day : '', count: sanitizeCount(savedToday.count) });
/** Taps not yet added to stats.tasbeehTotal (may be negative after undo). */
const pending = signal(0);

export const todayCount = computed(() => (todayStore.value.day === today.value ? todayStore.value.count : 0));
export const lifetimeCount = computed(() => Math.max(0, stats.value.tasbeehTotal + pending.value));
export const guided = computed(() => (config.value.mode === 'guided' ? guidedPosition(count.value) : null));

let timer: ReturnType<typeof setTimeout> | undefined;

/** Writes the session and today's count, and moves pending taps into the lifetime stat. */
export function flush(): void {
  clearTimeout(timer);
  timer = undefined;
  write('tasbeeh:session', { config: config.value, count: count.value } satisfies Saved);
  write('tasbeeh:today', todayStore.value);
  if (pending.value) {
    const by = Math.max(pending.value, -stats.value.tasbeehTotal);
    pending.value = 0;
    if (by) bumpStat('tasbeehTotal', by);
  }
}

function scheduleFlush(): void {
  if (timer === undefined) timer = setTimeout(flush, 1500);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
}

function addToday(delta: number): void {
  const t = todayStore.value;
  const base = t.day === today.value ? t.count : 0;
  todayStore.value = { day: today.value, count: Math.max(0, base + delta) };
}

/** One tap. Returns what happened so the UI can pick the haptic. */
export function tap(): TapKind {
  const next = count.value + 1;
  const kind = classifyTap(config.value, next);
  if (kind === 'ignored') return kind;
  count.value = next;
  pending.value += 1;
  addToday(1);
  scheduleFlush();
  return kind;
}

export function undo(): boolean {
  if (count.value <= 0) return false;
  count.value -= 1;
  pending.value -= 1;
  addToday(-1);
  scheduleFlush();
  return true;
}

export interface Snapshot {
  config: Config;
  count: number;
}

/** Starts a new session. Returns the previous one so the caller can offer "تراجع". */
export function resetSession(): Snapshot {
  const prev = { config: config.value, count: count.value };
  count.value = 0;
  flush();
  return prev;
}

/** Changes the dhikr, target or mode; a change starts a new session. */
export function configure(patch: Partial<Config>): Snapshot | null {
  const next = sanitizeConfig({ ...config.value, ...patch });
  const cur = config.value;
  if (next.mode === cur.mode && next.preset === cur.preset && next.custom === cur.custom && next.target === cur.target) return null;
  const prev = { config: cur, count: count.value };
  config.value = next;
  count.value = 0;
  flush();
  return prev;
}

export function restore(s: Snapshot): void {
  config.value = sanitizeConfig(s.config);
  count.value = sanitizeCount(s.count);
  flush();
}
