import data from '../../data/azkar.json';

export interface Zekr {
  text: string;
  /** Repetitions. */
  count: number;
  virtue?: string;
  /** Source, e.g. "البقرة 201". */
  ref?: string;
  /**
   * Whole Quran passage: "2:255", "2:285-286" or a surah number ("112"). When set, the
   * card shows the exact mushaf text (QPC Hafs) instead of `text` (kept as offline fallback).
   */
  q?: string;
  /** Lead-in before the passage: a = isti'adha, b = basmala. */
  pre?: 'a' | 'b';
}

export interface AzkarCategory {
  id: string;
  title: string;
  short: string;
  items: Zekr[];
}

export const CATEGORIES: AzkarCategory[] = (data as { categories: AzkarCategory[] }).categories;

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string | undefined): AzkarCategory | undefined {
  return id ? BY_ID.get(id) : undefined;
}
