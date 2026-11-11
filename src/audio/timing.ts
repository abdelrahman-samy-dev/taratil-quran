import { stripDiacritics } from '../lib/arabic';
import { fetchJSON } from '../lib/net';
import { chapter, surahText } from '../quran/data';

/**
 * Verse boundaries inside a surah audio file, in seconds.
 * starts[i] / ends[i] belong to ayah i+1. `intro` is the isti'adha/basmala lead-in.
 */
export interface VerseTimings {
  starts: number[];
  ends: number[];
  exact: boolean;
}

export interface ApiTiming {
  ayah: number;
  start_time: number;
  end_time: number;
}

/**
 * Maps mp3quran timing rows onto Hafs verse numbers. The API numbers rows in three
 * ways depending on the recording: 1..n (clean), 0..n (row 0 = isti'adha/basmala
 * lead-in) or 0..n-1 (row 0 is actually verse 1, e.g. Al-Fatiha for some reciters).
 * Recordings in other riwayat count verses differently (e.g. Warsh: Al-Baqarah has
 * 285); those can't be mapped verse-by-verse, so we return null and estimate instead.
 */
export function alignTimings(rows: ApiTiming[], verseCount: number): VerseTimings | null {
  const sorted = [...rows].sort((a, b) => a.ayah - b.ayah);
  if (!sorted.length) return null;
  let verses: ApiTiming[];
  if (sorted.length === verseCount + 1 && sorted[0].ayah === 0) verses = sorted.slice(1);
  else if (sorted.length === verseCount) verses = sorted;
  else return null;
  for (let i = 1; i < verses.length; i++) if (verses[i].start_time < verses[i - 1].start_time) return null;
  return {
    starts: verses.map((r) => r.start_time / 1000),
    ends: verses.map((r) => r.end_time / 1000),
    exact: true,
  };
}

/** Exact timings from mp3quran (same audio files we play). */
export async function exactTimings(recitationId: number, surah: number): Promise<VerseTimings | null> {
  try {
    const rows = await fetchJSON<ApiTiming[]>(
      `https://www.mp3quran.net/api/v3/ayat_timing?surah=${surah}&read=${recitationId}`,
      { retries: 1 },
    );
    return alignTimings(rows, chapter(surah).verses);
  } catch {
    return null;
  }
}

/**
 * Fallback when a recitation has no timing data: split the audio by verse length.
 * Good enough to follow along; the user can tap a verse to jump the audio to it.
 */
export async function estimatedTimings(surah: number, duration: number): Promise<VerseTimings> {
  const { v } = await surahText(surah);
  const lead = surah === 1 || surah === 9 ? 2 : 6; // isti'adha (+ basmala) before ayah 1
  const pause = 0.9;
  const weights = v.map((t) => stripDiacritics(t).replace(/\s+/g, '').length + 6);
  const total = weights.reduce((a, b) => a + b, 0);
  const usable = Math.max(1, duration - lead - pause * v.length);
  const starts: number[] = [];
  const ends: number[] = [];
  let t = lead;
  for (const w of weights) {
    const len = (w / total) * usable;
    starts.push(t);
    ends.push(t + len);
    t += len + pause;
  }
  return { starts, ends, exact: false };
}

/** Seconds of look-ahead so the highlight arrives with the verse, not after it. */
const LEAD = 0.25;

/** Index (0-based) of the verse playing at `time`, or -1 before the first verse. */
export function verseAt(t: VerseTimings, rawTime: number): number {
  const { starts } = t;
  const time = rawTime + LEAD;
  if (!starts.length || time < starts[0] - 0.05) return -1;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= time + 0.05) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
