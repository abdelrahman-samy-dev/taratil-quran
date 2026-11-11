/**
 * Prayer-time maths on top of `adhan` — pure functions, no app state, no side
 * effects, so the Home widget, the reminders and the tests can share them.
 *
 * Time-zone rule: a location's times are computed for *its own* calendar date
 * (not the device's) and adhan returns absolute instants, which the UI formats
 * in the location's IANA zone.
 */
import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PolarCircleResolution, PrayerTimes, Qibla, SunnahTimes } from 'adhan';
import { arNum } from '../../lib/arabic';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
/** The five obligatory prayers (sunrise is a time marker, not a prayer). */
export type SalahKey = Exclude<PrayerKey, 'sunrise'>;

export const TIME_KEYS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const SALAH_KEYS: SalahKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_NAMES: Record<PrayerKey, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
};

/** Dhuhr is labelled «الجمعة» on Fridays. */
export function prayerLabel(key: PrayerKey, friday = false): string {
  return key === 'dhuhr' && friday ? 'الجمعة' : PRAYER_NAMES[key];
}

export type MethodKey =
  | 'Egyptian'
  | 'UmmAlQura'
  | 'MuslimWorldLeague'
  | 'Karachi'
  | 'Dubai'
  | 'Kuwait'
  | 'Qatar'
  | 'Turkey'
  | 'Singapore'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Tehran';

export interface MethodInfo {
  key: MethodKey;
  name: string;
  /** Short description of the angles, shown under the picker. */
  detail: string;
}

/** Calculation methods offered by adhan, with their Arabic names. */
export const METHODS: MethodInfo[] = [
  { key: 'Egyptian', name: 'الهيئة المصرية العامة للمساحة', detail: 'الفجر ١٩٫٥° · العشاء ١٧٫٥°' },
  { key: 'UmmAlQura', name: 'تقويم أم القرى (مكة المكرمة)', detail: 'الفجر ١٨٫٥° · العشاء بعد المغرب بـ٩٠ دقيقة (١٢٠ في رمضان)' },
  { key: 'MuslimWorldLeague', name: 'رابطة العالم الإسلامي', detail: 'الفجر ١٨° · العشاء ١٧°' },
  { key: 'Karachi', name: 'جامعة العلوم الإسلامية بكراتشي', detail: 'الفجر ١٨° · العشاء ١٨°' },
  { key: 'Dubai', name: 'الإمارات (دبي)', detail: 'الفجر ١٨٫٢° · العشاء ١٨٫٢°' },
  { key: 'Kuwait', name: 'الكويت', detail: 'الفجر ١٨° · العشاء ١٧٫٥°' },
  { key: 'Qatar', name: 'قطر', detail: 'الفجر ١٨° · العشاء بعد المغرب بـ٩٠ دقيقة' },
  { key: 'Turkey', name: 'رئاسة الشؤون الدينية التركية', detail: 'تقريب لطريقة ديانت، الأدق داخل تركيا' },
  { key: 'Singapore', name: 'سنغافورة وماليزيا وإندونيسيا', detail: 'الفجر ٢٠° · العشاء ١٨°' },
  { key: 'MoonsightingCommittee', name: 'لجنة رؤية الهلال', detail: 'الفجر ١٨° · العشاء ١٨° مع تعديل موسمي' },
  { key: 'NorthAmerica', name: 'الجمعية الإسلامية لأمريكا الشمالية', detail: 'الفجر ١٥° · العشاء ١٥°' },
  { key: 'Tehran', name: 'معهد الجيوفيزياء بجامعة طهران', detail: 'الفجر ١٧٫٧° · العشاء ١٤° · المغرب ٤٫٥°' },
];

export function methodInfo(key: MethodKey): MethodInfo {
  return METHODS.find((m) => m.key === key) ?? METHODS[2];
}

const TZ_COUNTRY: Record<string, string> = { 'Africa/Cairo': 'EG', 'Asia/Riyadh': 'SA' };

/** Default method for a country: EG → Egyptian, SA → Umm al-Qura, else MWL. */
export function methodForCountry(countryCode?: string | null, tz?: string): MethodKey {
  const cc = (countryCode || (tz ? TZ_COUNTRY[tz] : '') || '').toUpperCase();
  if (cc === 'EG') return 'Egyptian';
  if (cc === 'SA') return 'UmmAlQura';
  return 'MuslimWorldLeague';
}

export type HighLatRule = 'middleofthenight' | 'seventhofthenight' | 'twilightangle';

export const HIGH_LAT_RULES: { key: HighLatRule | 'auto'; name: string }[] = [
  { key: 'auto', name: 'تلقائي (الموصى به للموقع)' },
  { key: 'middleofthenight', name: 'منتصف الليل' },
  { key: 'seventhofthenight', name: 'سُبع الليل' },
  { key: 'twilightangle', name: 'نسبة زاوية الشفق' },
];

export type Adjustments = Record<PrayerKey, number>;

export interface CalcSettings {
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  highLatRule: HighLatRule | 'auto';
  adjustments: Adjustments;
}

export interface Place {
  lat: number;
  lon: number;
  tz: string;
}

export interface YMD {
  y: number;
  /** 1–12 */
  m: number;
  d: number;
}

export const ZERO_ADJUSTMENTS: Adjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

// ── Time-zone helpers ──────────────────────────────────────────────────────

const ymdFmt = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Calendar date of `date` as seen in `tz`. */
export function zonedYMD(date: Date, tz: string): YMD {
  let f = ymdFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: isValidTimeZone(tz) ? tz : undefined,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      numberingSystem: 'latn',
    });
    ymdFmt.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(date)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p.year, m: p.month, d: p.day };
}

/** Shift a calendar date by whole days (pure calendar arithmetic, no zones). */
export function addDaysYMD(ymd: YMD, delta: number): YMD {
  const t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + delta));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 0 = Sunday … 5 = Friday. */
export function weekdayOf(ymd: YMD): number {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
}

export function ymdKey(ymd: YMD): string {
  return `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const hijriMonthFmt = (() => {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', timeZone: 'UTC' });
  } catch {
    return null;
  }
})();

/** Whether a calendar day falls in Ramadan (Umm al-Qura calendar). */
export function isRamadan(ymd: YMD): boolean {
  if (!hijriMonthFmt) return false;
  const month = hijriMonthFmt.formatToParts(new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12))).find((p) => p.type === 'month');
  return Number(month?.value) === 9;
}

// ── Prayer times ───────────────────────────────────────────────────────────

export function buildParams(settings: CalcSettings, place: Place, ymd?: YMD) {
  const params = (CalculationMethod[settings.method] ?? CalculationMethod.MuslimWorldLeague)();
  const coords = new Coordinates(place.lat, place.lon);
  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = settings.highLatRule === 'auto' ? HighLatitudeRule.recommended(coords) : settings.highLatRule;
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  const adj = { ...ZERO_ADJUSTMENTS, ...settings.adjustments };
  params.adjustments = { ...adj };
  // adhan's note for Umm al-Qura: Isha is 120 minutes after Maghrib in Ramadan.
  if (settings.method === 'UmmAlQura' && ymd && isRamadan(ymd)) params.adjustments.isha += 30;
  return { params, coords };
}

export interface DayTimes {
  ymd: YMD;
  friday: boolean;
  times: Record<PrayerKey, Date>;
  /** Midpoint between Maghrib and the next Fajr. */
  middleOfNight: Date;
  /** Start of the last third of the night (Maghrib → next Fajr). */
  lastThird: Date;
}

export function computeDay(place: Place, settings: CalcSettings, ymd: YMD, withSunnah = true): DayTimes {
  const { params, coords } = buildParams(settings, place, ymd);
  // adhan reads only the local y/m/d of this Date; noon avoids DST-at-midnight gaps.
  const pt = new PrayerTimes(coords, new Date(ymd.y, ymd.m - 1, ymd.d, 12), params);
  const times: Record<PrayerKey, Date> = {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
  let middleOfNight = new Date(Number.NaN);
  let lastThird = new Date(Number.NaN);
  if (withSunnah) {
    const s = new SunnahTimes(pt);
    middleOfNight = s.middleOfTheNight;
    lastThird = s.lastThirdOfTheNight;
  }
  return { ymd, friday: weekdayOf(ymd) === 5, times, middleOfNight, lastThird };
}

export function isValidDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export interface NextPrayer {
  key: SalahKey;
  time: Date;
  /** Display name (Dhuhr → «الجمعة» on Fridays). */
  label: string;
  /** The next prayer falls on the location's next calendar day (after Isha). */
  tomorrow: boolean;
  /** Latest time marker already reached today (incl. sunrise), or null before Fajr. */
  current: PrayerKey | null;
  /** When the current period started (previous prayer, or yesterday's Isha). */
  since: Date;
  /** Today's times at the location. */
  day: DayTimes;
}

/** Next of the five prayers after `now`; after Isha it rolls to tomorrow's Fajr. */
export function nextPrayer(place: Place, settings: CalcSettings, now: Date = new Date()): NextPrayer {
  const ymd = zonedYMD(now, place.tz);
  const day = computeDay(place, settings, ymd);
  const t = now.getTime();

  let current: PrayerKey | null = null;
  for (const k of TIME_KEYS) if (isValidDate(day.times[k]) && day.times[k].getTime() <= t) current = k;

  for (const k of SALAH_KEYS) {
    const time = day.times[k];
    if (isValidDate(time) && time.getTime() > t) {
      const prev = previousSalahTime(place, settings, day, k);
      return { key: k, time, label: prayerLabel(k, day.friday), tomorrow: false, current, since: prev, day };
    }
  }
  const next = computeDay(place, settings, addDaysYMD(ymd, 1), false);
  return {
    key: 'fajr',
    time: next.times.fajr,
    label: PRAYER_NAMES.fajr,
    tomorrow: true,
    current,
    since: day.times.isha,
    day,
  };
}

function previousSalahTime(place: Place, settings: CalcSettings, day: DayTimes, key: SalahKey): Date {
  const i = SALAH_KEYS.indexOf(key);
  if (i > 0) return day.times[SALAH_KEYS[i - 1]];
  return computeDay(place, settings, addDaysYMD(day.ymd, -1), false).times.isha;
}

/** Every day of a (location-calendar) month. ~30 adhan runs: a few milliseconds. */
export function monthTimes(place: Place, settings: CalcSettings, y: number, m: number): DayTimes[] {
  const out: DayTimes[] = [];
  const n = daysInMonth(y, m);
  for (let d = 1; d <= n; d++) out.push(computeDay(place, settings, { y, m, d }, false));
  return out;
}

// ── Formatting ─────────────────────────────────────────────────────────────

const partsFmt = new Map<string, Intl.DateTimeFormat>();

/** "٤:٤٨" + "ص" in the location's zone, split so the period can be styled. */
export function timeParts(date: Date, tz: string, hour12: boolean): { time: string; period: string } {
  if (!isValidDate(date)) return { time: '—', period: '' };
  const key = `${tz}|${hour12}`;
  let f = partsFmt.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('ar-EG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12,
      timeZone: isValidTimeZone(tz) ? tz : undefined,
    });
    partsFmt.set(key, f);
  }
  let time = '';
  let period = '';
  for (const p of f.formatToParts(date)) {
    if (p.type === 'dayPeriod') period = p.value;
    else if (p.type === 'hour' || p.type === 'minute') time += p.value;
    else if (p.type === 'literal' && p.value.trim() === ':') time += ':';
  }
  return { time: arNum(time), period };
}

// ── Qibla ──────────────────────────────────────────────────────────────────

export const KAABA = { lat: 21.4225241, lon: 39.8261818 };

/** Bearing to the Kaaba in degrees clockwise from true north (0–360). */
export function qiblaBearing(lat: number, lon: number): number {
  return Qibla(new Coordinates(lat, lon));
}

/** Great-circle distance to the Kaaba in kilometres (haversine). */
export function kaabaDistanceKm(lat: number, lon: number): number {
  const R = 6371.0088;
  const rad = Math.PI / 180;
  const dLat = (KAABA.lat - lat) * rad;
  const dLon = (KAABA.lon - lon) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(KAABA.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const WINDS = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'];

/** Arabic name of the nearest of the eight compass directions. */
export function compassName(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return WINDS[i];
}

/** Signed smallest difference a − b in degrees, in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (((a - b) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}
