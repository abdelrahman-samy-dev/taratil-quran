import data from '../../data/azkar.json';

export interface Zekr {
  text: string;
  /** Repetitions. */
  count: number;
  virtue?: string;
  /** Source, e.g. "البقرة 201". */
  ref?: string;
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
