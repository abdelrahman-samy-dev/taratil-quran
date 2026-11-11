import { describe, expect, it } from 'vitest';
import {
  type CalcSettings,
  type Place,
  ZERO_ADJUSTMENTS,
  addDaysYMD,
  angleDiff,
  compassName,
  computeDay,
  kaabaDistanceKm,
  methodForCountry,
  monthTimes,
  nextPrayer,
  prayerLabel,
  qiblaBearing,
  timeParts,
  zonedYMD,
} from '../../src/features/prayer/calc';

const CAIRO: Place = { lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo' };
const EGYPTIAN: CalcSettings = { method: 'Egyptian', madhab: 'shafi', highLatRule: 'auto', adjustments: { ...ZERO_ADJUSTMENTS } };
const DAY = { y: 2026, m: 11, d: 11 };

/** Minutes since local midnight in `tz`. */
function localMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return h * 60 + m;
}

const hm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

describe('prayer times (adhan, on-device)', () => {
  const day = computeDay(CAIRO, EGYPTIAN, DAY);
  const expected: Record<string, string> = {
    fajr: '04:48',
    sunrise: '06:17',
    dhuhr: '11:39',
    asr: '14:41',
    maghrib: '17:01',
    isha: '18:21',
  };

  for (const [key, time] of Object.entries(expected)) {
    it(`Cairo ${key} on 2026-11-11 ≈ ${time} (±2 min)`, () => {
      const got = localMinutes(day.times[key as keyof typeof day.times], 'Africa/Cairo');
      expect(Math.abs(got - hm(time))).toBeLessThanOrEqual(2);
    });
  }

  it('orders the six times and the night markers', () => {
    const t = day.times;
    expect(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha).toBe(true);
    expect(day.middleOfNight > t.isha).toBe(true);
    expect(day.lastThird > day.middleOfNight).toBe(true);
  });

  it('Hanafi Asr is later than the majority Asr', () => {
    const hanafi = computeDay(CAIRO, { ...EGYPTIAN, madhab: 'hanafi' }, DAY);
    expect(hanafi.times.asr.getTime() - day.times.asr.getTime()).toBeGreaterThan(30 * 60_000);
  });

  it('applies manual adjustments in minutes', () => {
    const adj = computeDay(CAIRO, { ...EGYPTIAN, adjustments: { ...ZERO_ADJUSTMENTS, fajr: 3, isha: -2 } }, DAY);
    expect(adj.times.fajr.getTime() - day.times.fajr.getTime()).toBe(3 * 60_000);
    expect(adj.times.isha.getTime() - day.times.isha.getTime()).toBe(-2 * 60_000);
  });

  it('uses the location calendar date, not the device one', () => {
    // 23:30 UTC on 10 Nov is already 11 Nov in Cairo (UTC+2).
    expect(zonedYMD(new Date(Date.UTC(2026, 10, 10, 23, 30)), 'Africa/Cairo')).toEqual(DAY);
    // Same instant is still 10 Nov in New York.
    expect(zonedYMD(new Date(Date.UTC(2026, 10, 10, 23, 30)), 'America/New_York')).toEqual({ y: 2026, m: 11, d: 10 });
  });

  it('builds a full month', () => {
    const month = monthTimes(CAIRO, EGYPTIAN, 2026, 11);
    expect(month).toHaveLength(30);
    expect(month[10].ymd).toEqual(DAY);
    expect(month[10].times.fajr.getTime()).toBe(day.times.fajr.getTime());
  });

  it('Umm al-Qura adds 30 minutes to Isha in Ramadan', () => {
    const umm: CalcSettings = { ...EGYPTIAN, method: 'UmmAlQura' };
    const riyadh: Place = { lat: 24.7136, lon: 46.6753, tz: 'Asia/Riyadh' };
    // 1 Ramadan 1448 ≈ 9 Feb 2027 (Umm al-Qura); 1 Feb is still Shaban.
    const ramadan = computeDay(riyadh, umm, { y: 2027, m: 2, d: 15 });
    const shaban = computeDay(riyadh, umm, { y: 2027, m: 2, d: 1 });
    expect(Math.round((ramadan.times.isha.getTime() - ramadan.times.maghrib.getTime()) / 60_000)).toBe(120);
    expect(Math.round((shaban.times.isha.getTime() - shaban.times.maghrib.getTime()) / 60_000)).toBe(90);
  });
});

describe('next prayer', () => {
  const day = computeDay(CAIRO, EGYPTIAN, DAY);

  it('finds the next prayer during the day (sunrise is skipped)', () => {
    const afterFajr = new Date(day.times.fajr.getTime() + 10 * 60_000);
    const n = nextPrayer(CAIRO, EGYPTIAN, afterFajr);
    expect(n.key).toBe('dhuhr');
    expect(n.current).toBe('fajr');
    expect(n.tomorrow).toBe(false);
    expect(n.since.getTime()).toBe(day.times.fajr.getTime());
  });

  it('rolls over to tomorrow’s Fajr after Isha', () => {
    const afterIsha = new Date(day.times.isha.getTime() + 60_000);
    const n = nextPrayer(CAIRO, EGYPTIAN, afterIsha);
    const tomorrow = computeDay(CAIRO, EGYPTIAN, addDaysYMD(DAY, 1));
    expect(n.key).toBe('fajr');
    expect(n.tomorrow).toBe(true);
    expect(n.current).toBe('isha');
    expect(n.time.getTime()).toBe(tomorrow.times.fajr.getTime());
    expect(n.since.getTime()).toBe(day.times.isha.getTime());
  });

  it('before Fajr the next is today’s Fajr, counted from last night’s Isha', () => {
    const early = new Date(day.times.fajr.getTime() - 60 * 60_000);
    const n = nextPrayer(CAIRO, EGYPTIAN, early);
    const yesterday = computeDay(CAIRO, EGYPTIAN, addDaysYMD(DAY, -1));
    expect(n.key).toBe('fajr');
    expect(n.tomorrow).toBe(false);
    expect(n.current).toBeNull();
    expect(n.since.getTime()).toBe(yesterday.times.isha.getTime());
  });

  it('labels Dhuhr as Jumuah on Fridays', () => {
    const friday = computeDay(CAIRO, EGYPTIAN, { y: 2026, m: 11, d: 13 });
    expect(friday.friday).toBe(true);
    const n = nextPrayer(CAIRO, EGYPTIAN, new Date(friday.times.sunrise.getTime() + 60_000));
    expect(n.key).toBe('dhuhr');
    expect(n.label).toBe('الجمعة');
    expect(prayerLabel('dhuhr', false)).toBe('الظهر');
  });
});

describe('qibla', () => {
  it('Cairo bearing ≈ 136°', () => {
    expect(Math.abs(qiblaBearing(CAIRO.lat, CAIRO.lon) - 136)).toBeLessThan(1);
  });

  it('distance Cairo → Kaaba ≈ 1,287 km', () => {
    expect(Math.abs(kaabaDistanceKm(CAIRO.lat, CAIRO.lon) - 1287)).toBeLessThan(10);
  });

  it('names directions and measures signed angle differences', () => {
    expect(compassName(136)).toBe('الجنوب الشرقي');
    expect(compassName(359)).toBe('الشمال');
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
    expect(angleDiff(180, 0)).toBe(180);
  });
});

describe('helpers', () => {
  it('default method by country', () => {
    expect(methodForCountry('EG')).toBe('Egyptian');
    expect(methodForCountry('sa')).toBe('UmmAlQura');
    expect(methodForCountry('GB')).toBe('MuslimWorldLeague');
    expect(methodForCountry(undefined, 'Asia/Riyadh')).toBe('UmmAlQura');
  });

  it('formats times in the location zone with Arabic digits', () => {
    const fajr = computeDay(CAIRO, EGYPTIAN, DAY).times.fajr;
    expect(timeParts(fajr, 'Africa/Cairo', true)).toEqual({ time: '٤:٤٨', period: 'ص' });
    expect(timeParts(fajr, 'Africa/Cairo', false).time).toMatch(/^٠?٤:٤٨$/);
  });
});
