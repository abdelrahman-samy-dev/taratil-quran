import { computed, effect, signal } from '@preact/signals';
import { persisted } from '../lib/storage';

export type Theme = 'system' | 'light' | 'dark' | 'amoled';
export type Shape = 'rounded' | 'sharp' | 'minimal';
export type MushafTone = 'paper' | 'white' | 'sepia';

export interface Prefs {
  theme: Theme;
  shape: Shape;
  /** UI text scale (0.85 – 1.3). */
  fontScale: number;
  /** Quran text scale in tafsir / player views (0.8 – 1.8). */
  quranScale: number;
  haptics: boolean;
  /** Play the next surah when one ends. */
  autoplay: boolean;
  /** Keep the screen awake while reading the mushaf or azkar. */
  keepAwake: boolean;
  /** mp3quran moshaf id of the selected recitation. */
  reciter: number;
  tafsir: string;
  mushafTone: MushafTone;
  /** Page dimming for night reading (0 – 0.6). */
  mushafDim: number;
  /** Show two pages side by side on wide screens. */
  mushafSpread: boolean;
  hijriAdjust: number;
  hour12: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  shape: 'rounded',
  fontScale: 1,
  quranScale: 1,
  haptics: true,
  autoplay: true,
  keepAwake: true,
  reciter: 118, // محمود خليل الحصري — حفص عن عاصم مرتل (has verse timings)
  tafsir: 'ar.muyassar',
  mushafTone: 'paper',
  mushafDim: 0,
  mushafSpread: true,
  hijriAdjust: 0,
  hour12: true,
};

export const prefs = persisted<Prefs>('prefs', DEFAULT_PREFS);

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  prefs.value = { ...prefs.value, [key]: value };
}

const systemDark = signal(typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => (systemDark.value = e.matches));
}

export const resolvedTheme = computed<'light' | 'dark' | 'amoled'>(() => {
  const t = prefs.value.theme;
  if (t === 'system') return systemDark.value ? 'dark' : 'light';
  return t;
});

const THEME_COLOR = { light: '#059669', dark: '#09090b', amoled: '#000000' } as const;

effect(() => {
  const root = document.documentElement;
  const theme = resolvedTheme.value;
  root.dataset.theme = theme;
  root.dataset.shape = prefs.value.shape;
  root.style.setProperty('--font-scale', String(prefs.value.fontScale));
  root.style.setProperty('--quran-scale', String(prefs.value.quranScale));
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLOR[theme]));
});
