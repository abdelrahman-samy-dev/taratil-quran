const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/**
 * Normalises Arabic text for search: strips tashkeel, tatweel and Quranic marks,
 * unifies alef/hamza forms, taa marbuta and alef maqsura.
 */
export function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(DIACRITICS, '')
    .replace(/[إأآٱا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function stripDiacritics(text: string): string {
  return text.replace(DIACRITICS, '');
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** 123 → ١٢٣ */
export function arNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

/** ١٢٣ / 123 → 123 */
export function parseArNum(s: string): number {
  const western = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  return Number.parseInt(western, 10);
}

/** Arabic count wording: ١ آية، ٢ آيتان، ٣ آيات، ١١ آية */
export function plural(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `${arNum(n)} ${few}`;
  return `${arNum(n)} ${many}`;
}
