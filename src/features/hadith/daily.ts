/**
 * «حديث اليوم»: one complete hadith per calendar day, alternating between
 * An-Nawawi's forty and the forty Qudsi hadith. Deterministic for a given
 * local date, so every screen and every device shows the same one.
 * Import-safe for the Home screen: nothing runs until the function is called.
 */
import { fetchJSON } from '../../lib/net';
import { editionUrl, type RawEdition } from './api';

export interface DailyHadith {
  text: string;
  number: number;
  bookName: string;
  /** Book slug, e.g. 'nawawi'. */
  book: string;
  /** Link to the hadith inside its book. */
  href: string;
}

const POOLS = [
  { slug: 'nawawi', name: 'الأربعون النووية', count: 42 },
  { slug: 'qudsi', name: 'الأحاديث القدسية', count: 40 },
] as const;

/** Days since 1970-01-01 for the *local* calendar date. */
export function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** Which hadith to show on a given date (pure, no network). */
export function pickDaily(date: Date = new Date()): { book: string; bookName: string; number: number } {
  const d = dayNumber(date);
  const pool = POOLS[((d % 2) + 2) % 2];
  const number = (Math.floor(d / 2) % pool.count) + 1;
  return { book: pool.slug, bookName: pool.name, number };
}

export async function hadithOfTheDay(date: Date = new Date()): Promise<DailyHadith> {
  const pick = pickDaily(date);
  const data = await fetchJSON<RawEdition>(editionUrl(pick.book));
  const h = data.hadiths.find((x) => x.hadithnumber === pick.number && x.text?.trim()) ?? data.hadiths[0];
  return {
    text: h.text.replace(/[‎‏]/g, '').trim(),
    number: h.hadithnumber,
    bookName: pick.bookName,
    book: pick.book,
    href: `/hadith/${pick.book}?n=${h.hadithnumber}`,
  };
}
