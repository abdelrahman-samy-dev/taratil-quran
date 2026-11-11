/**
 * Prayer location + calculation settings (localStorage-backed signals).
 * Importing this file only reads storage; network work (legacy migration)
 * runs when a screen calls `migrateLegacyCity()`.
 */
import { computed } from '@preact/signals';
import { persisted, read, remove } from '../../lib/storage';
import { toast } from '../../ui/toast';
import {
  type Adjustments,
  type CalcSettings,
  type HighLatRule,
  type MethodKey,
  type NextPrayer,
  METHODS,
  ZERO_ADJUSTMENTS,
  methodForCountry,
  nextPrayer,
} from './calc';
import { type CityResult, type PrayerLocation, cityToLocation, searchCities } from './geo';

export type { PrayerLocation } from './geo';

export interface PrayerSettings {
  /** 'auto' = by the location's country (EG → Egyptian, SA → Umm al-Qura, else MWL). */
  method: MethodKey | 'auto';
  madhab: 'shafi' | 'hanafi';
  highLatRule: HighLatRule | 'auto';
  /** Manual offsets in minutes, per time. */
  adjustments: Adjustments;
  /** In-app reminder when a prayer time arrives (only while the app is open). */
  notify: boolean;
}

export const DEFAULT_LOCATION: PrayerLocation = {
  name: 'القاهرة',
  country: 'مصر',
  countryCode: 'EG',
  lat: 30.0444,
  lon: 31.2357,
  tz: 'Africa/Cairo',
};

export const DEFAULT_SETTINGS: PrayerSettings = {
  method: 'auto',
  madhab: 'shafi',
  highLatRule: 'auto',
  adjustments: { ...ZERO_ADJUSTMENTS },
  notify: false,
};

/** null until the user picks a place; the UI then shows Cairo with a prompt. */
export const savedLocation = persisted<PrayerLocation | null>('prayer:location', null);
export const prayerSettings = persisted<PrayerSettings>('prayer:settings', DEFAULT_SETTINGS);

export const prayerLocation = computed<PrayerLocation>(() => {
  const l = savedLocation.value;
  return l && Number.isFinite(l.lat) && Number.isFinite(l.lon) && l.tz ? l : DEFAULT_LOCATION;
});

export const isDefaultLocation = computed(() => prayerLocation.value === DEFAULT_LOCATION);

export const effectiveMethod = computed<MethodKey>(() => {
  const m = prayerSettings.value.method;
  if (m !== 'auto' && METHODS.some((x) => x.key === m)) return m;
  const loc = prayerLocation.value;
  return methodForCountry(loc.countryCode, loc.tz);
});

/** Settings in the shape the calculator wants. */
export const calcSettings = computed<CalcSettings>(() => {
  const s = prayerSettings.value;
  return {
    method: effectiveMethod.value,
    madhab: s.madhab === 'hanafi' ? 'hanafi' : 'shafi',
    highLatRule: s.highLatRule ?? 'auto',
    adjustments: { ...ZERO_ADJUSTMENTS, ...s.adjustments },
  };
});

export function setLocation(loc: PrayerLocation): void {
  savedLocation.value = loc;
}

export function setPrayerSetting<K extends keyof PrayerSettings>(key: K, value: PrayerSettings[K]): void {
  prayerSettings.value = { ...prayerSettings.value, [key]: value };
}

/** Next prayer for the saved location and settings (cheap; safe to call each second). */
export function nextPrayerNow(now: Date = new Date()): NextPrayer {
  return nextPrayer(prayerLocation.value, calcSettings.value, now);
}

// ── v3 migration: the old app stored a typed city name; geocode it once. ─────

const LEGACY_KEY = 'prayer:legacyCity';
let migration: Promise<void> | null = null;

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function pickLegacyMatch(ar: CityResult[], en: CityResult[], country: string): CityResult | undefined {
  const c = norm(country);
  if (!c) return ar[0];
  const hit = (r: CityResult) => norm(r.country) === c || norm(r.country_code) === c;
  const arHit = ar.find(hit);
  if (arHit) return arHit;
  const enHit = en.find(hit);
  if (enHit) return ar.find((r) => r.id === enHit.id) ?? enHit;
  return ar[0];
}

export function migrateLegacyCity(): Promise<void> {
  if (migration) return migration;
  const legacy = read<{ city?: string; country?: string } | null>(LEGACY_KEY, null);
  if (!legacy) return (migration = Promise.resolve());
  if (savedLocation.value || !legacy.city?.trim()) {
    remove(LEGACY_KEY);
    return (migration = Promise.resolve());
  }
  migration = (async () => {
    try {
      const city = legacy.city!.trim();
      const [ar, en] = await Promise.all([searchCities(city, undefined, 'ar'), searchCities(city, undefined, 'en').catch(() => [])]);
      const match = pickLegacyMatch(ar, en, legacy.country ?? '');
      if (match && !savedLocation.value) {
        setLocation(cityToLocation(match, 'legacy'));
        toast(`نُقلت مدينتك المحفوظة: ${match.name}`);
      }
      remove(LEGACY_KEY); // geocoded (or not found): never try again
    } catch {
      migration = null; // offline: retry on the next visit
    }
  })();
  return migration;
}
