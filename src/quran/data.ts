import chaptersJson from '../data/chapters.json';
import { fetchJSON } from '../lib/net';

export interface Chapter {
  id: number;
  ar: string;
  en: string;
  place: 'makkah' | 'madinah';
  order: number;
  verses: number;
  pages: [number, number];
  bismillah: boolean;
}

export const chapters = chaptersJson as Chapter[];
export const TOTAL_PAGES = 604;

export function chapter(id: number): Chapter {
  return chapters[Math.min(114, Math.max(1, id)) - 1];
}

export const placeLabel = (c: Chapter) => (c.place === 'madinah' ? 'مدنية' : 'مكية');

/** Surah whose range contains `page` (the last one that starts on or before it). */
export function chapterAtPage(page: number): Chapter {
  let found = chapters[0];
  for (const c of chapters) {
    if (c.pages[0] <= page) found = c;
    else break;
  }
  return found;
}

export interface SurahText {
  id: number;
  /** Uthmani text per ayah (index 0 = ayah 1). */
  v: string[];
  /** Mushaf page per ayah. */
  p: number[];
  /** Juz per ayah. */
  j: number[];
}

export const surahText = (id: number) => fetchJSON<SurahText>(`/data/quran/text/${id}.json`);

/** One line of a QCF v2 mushaf page. */
export type MushafLine =
  | { n: number; t: 'a'; w: [glyph: string, verseIndex: number, isEnd: 0 | 1][] }
  | { n: number; t: 's' | 'b'; s: number };

export interface MushafPageData {
  p: number;
  juz: number;
  hizb: number;
  rub: number;
  /** Verse keys on this page, referenced by index from the words. */
  k: string[];
  l: MushafLine[];
}

export const mushafPage = (p: number) => fetchJSON<MushafPageData>(`/data/mushaf/${p}.json`);

/** Parse "2:255" */
export function parseKey(key: string): [surah: number, ayah: number] {
  const [s, a] = key.split(':').map(Number);
  return [s, a];
}

export const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
