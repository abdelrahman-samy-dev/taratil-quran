import { persisted } from '../../lib/storage';
import { arNum, plural } from '../../lib/arabic';
import { sectionTitle, type BookInfo } from './catalog';
import type { Section } from './data';

/** Last hadith number seen per book: { bukhari: 123 }. */
export const lastRead = persisted<Record<string, number>>('hadith:last', {});

/** 402.2 → ٤٠٢٫٢ */
export function num(n: number | string): string {
  return arNum(String(n)).replace('.', '٫');
}

export function hadithCount(n: number): string {
  return plural(n, 'حديث واحد', 'حديثان', 'أحاديث', 'حديثًا');
}

export function compilerLine(b: BookInfo): string {
  return b.died ? `${b.compiler} (ت ${arNum(b.died)}هـ)` : b.compiler;
}

/** «كتاب الإيمان» for books with verified titles, otherwise «الكتاب ٣». */
export function sectionLabel(slug: string, s: Section, index: number): string {
  return sectionTitle(slug, s.id) ?? `الكتاب ${arNum(index + 1)}`;
}

export function rangeLabel(s: Section): string {
  return s.first === s.last ? `الحديث ${num(s.first)}` : `الأحاديث ${num(s.first)}–${num(s.last)}`;
}

/** Abd al-Baqi number "8.01" → ٨ (sub-narrations share the main number). */
export function altLabel(alt: string): string {
  const main = Math.floor(Number.parseFloat(alt));
  return Number.isFinite(main) ? arNum(main) : arNum(alt);
}
