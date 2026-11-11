/**
 * Pure search helpers for the Quran search screen: index building, matching,
 * highlighting, reference parsing ("٢:٢٥٥", "البقرة 255") and surah-name lookup.
 * No DOM access, so everything here is unit-tested.
 */
import meta from '../../data/quran-meta.json';
import { normalizeArabic } from '../../lib/arabic';
import { chapters, type Chapter } from '../../quran/data';

/** One row of /data/quran/search.json: [surah, ayah, imlaei text with diacritics]. */
export type Row = [surah: number, ayah: number, text: string];

export interface Entry {
  s: number;
  a: number;
  /** Display text (imlaei, with diacritics). */
  t: string;
  /** Normalised text (normalizeArabic). */
  n: string;
}

export const MIN_QUERY = 2;

/**
 * Builds the normalised index once. Yields to the event loop every `chunk` rows
 * so typing stays responsive on slow phones while it is being built.
 */
export async function buildIndex(rows: Row[], chunk = 1200): Promise<Entry[]> {
  const out: Entry[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const [s, a, t] = rows[i];
    out[i] = { s, a, t, n: normalizeArabic(t) };
    if (chunk > 0 && i % chunk === chunk - 1) await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

export interface SearchResult {
  /** Normalised phrase that was searched. */
  phrase: string;
  /** Words of the phrase (used when the words appear apart). */
  terms: string[];
  /** Index positions whose text contains the whole phrase, in mushaf order. */
  exact: number[];
  /** Positions containing every word but not the exact phrase. */
  loose: number[];
}

/** Letters only (no digits, marks or punctuation): the "at least 2 letters" rule. */
export function letterCount(query: string): number {
  return normalizeArabic(query).match(/\p{L}/gu)?.length ?? 0;
}

export function searchIndex(index: readonly Entry[], query: string): SearchResult | null {
  const phrase = normalizeArabic(query);
  if (letterCount(phrase) < MIN_QUERY) return null;
  const terms = phrase.split(' ').filter((t) => t.length >= MIN_QUERY);
  const exact: number[] = [];
  const loose: number[] = [];
  const multi = terms.length > 1;
  for (let i = 0; i < index.length; i++) {
    const n = index[i].n;
    if (n.includes(phrase)) exact.push(i);
    else if (multi && terms.every((t) => n.includes(t))) loose.push(i);
  }
  return { phrase, terms, exact, loose };
}

// ── Highlighting ─────────────────────────────────────────────────────────

const DIACRITIC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/;
const FOLD: Record<string, string> = {
  '\u0625': '\u0627', // إ
  '\u0623': '\u0627', // أ
  '\u0622': '\u0627', // آ
  '\u0671': '\u0627', // ٱ
  '\u0629': '\u0647', // ة → ه
  '\u0649': '\u064A', // ى → ي
  '\u0624': '\u0648', // ؤ → و
  '\u0626': '\u064A', // ئ → ي
};
const SPACE = /\s/;

/**
 * Same output as normalizeArabic(), plus `map[i]` = index in `text` of the
 * character that produced normalised character i.
 */
export function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (DIACRITIC.test(ch)) continue;
    if (SPACE.test(ch)) {
      if (norm.length && norm[norm.length - 1] !== ' ') {
        norm += ' ';
        map.push(i);
      }
      continue;
    }
    norm += (FOLD[ch] ?? ch).toLowerCase();
    map.push(i);
  }
  if (norm.endsWith(' ')) {
    norm = norm.slice(0, -1);
    map.pop();
  }
  return { norm, map };
}

export interface Segment {
  t: string;
  /** Part of a match. */
  m: boolean;
}

/**
 * Splits `text` into plain and highlighted segments. Matches are widened to
 * whole words so marks never cut through a letter's diacritics or joining.
 */
export function highlight(text: string, terms: readonly string[]): Segment[] {
  const wanted = terms.filter(Boolean);
  if (!wanted.length) return [{ t: text, m: false }];
  const { norm, map } = normalizeWithMap(text);
  const ranges: [number, number][] = [];
  for (const term of wanted) {
    let from = 0;
    for (;;) {
      const i = norm.indexOf(term, from);
      if (i < 0) break;
      let start = map[i];
      let end = map[i + term.length - 1] + 1;
      while (start > 0 && !SPACE.test(text[start - 1])) start--;
      while (end < text.length && !SPACE.test(text[end])) end++;
      ranges.push([start, end]);
      from = i + Math.max(1, term.length);
    }
  }
  if (!ranges.length) return [{ t: text, m: false }];
  ranges.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    // Touching or separated only by a space: one mark reads better.
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: Segment[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ t: text.slice(pos, s), m: false });
    out.push({ t: text.slice(s, e), m: true });
    pos = e;
  }
  if (pos < text.length) out.push({ t: text.slice(pos), m: false });
  return out;
}

// ── References & surah names ─────────────────────────────────────────────

/** ٢٥٥ / ۲۵۵ → 255 (other characters untouched). */
export function toWesternDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Well-known alternative names (normalised), surah id → names. */
const ALIASES: Record<number, string[]> = {
  1: ['الحمد', 'ام الكتاب', 'السبع المثاني'],
  9: ['براءه'],
  17: ['بني اسراييل'],
  40: ['المومن'],
  41: ['حم السجده'],
  47: ['القتال'],
  76: ['الدهر'],
  94: ['الانشراح', 'الم نشرح'],
  111: ['تبت'],
  112: ['التوحيد'],
};

interface NameKey {
  c: Chapter;
  names: string[];
  latin: string;
}

const stripAl = (s: string) => s.replace(/^ال/, '').trim();
const latinKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

let nameKeys: NameKey[] | null = null;
function names(): NameKey[] {
  if (!nameKeys) {
    nameKeys = chapters.map((c) => ({
      c,
      names: [normalizeArabic(c.ar), ...(ALIASES[c.id] ?? [])],
      latin: latinKey(c.en),
    }));
  }
  return nameKeys;
}

/** Removes "سورة" before and "آية" / trailing numbers after a name. */
function cleanName(q: string): string {
  return normalizeArabic(toWesternDigits(q))
    .replace(/[:\uFF1A\u060C,\-\d]+/g, ' ')
    .replace(/^سور(?:ه|ة)\s*/, '')
    .replace(/\s*(?:ال)?ايه\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exact surah for a typed name ("البقرة", "بقره", "Al-Baqarah", "براءة"). */
export function surahByName(input: string): Chapter | null {
  const q = cleanName(input);
  if (!q) return null;
  const bare = stripAl(q);
  const lq = latinKey(input);
  for (const k of names()) {
    if (k.names.some((n) => n === q || stripAl(n) === bare)) return k.c;
  }
  if (lq.length >= 3) {
    const hit = names().find((k) => k.latin === lq || k.latin === `al${lq}`);
    if (hit) return hit.c;
  }
  return null;
}

/** Surahs whose name matches the query, best first. */
export function matchSurahs(input: string, limit = 5): Chapter[] {
  const q = cleanName(input);
  const bare = stripAl(q);
  const lq = latinKey(input);
  const arabic = bare.length >= 2;
  const latin = lq.length >= 3;
  if (!arabic && !latin) return [];
  const scored: { c: Chapter; score: number }[] = [];
  for (const k of names()) {
    let score = 99;
    if (arabic) {
      for (const n of k.names) {
        const nb = stripAl(n);
        if (n === q || nb === bare) score = Math.min(score, 0);
        else if (nb.startsWith(bare) || n.startsWith(q)) score = Math.min(score, 1);
        else if (n.includes(bare)) score = Math.min(score, 2);
      }
    }
    if (latin) {
      if (k.latin === lq || k.latin === `al${lq}`) score = Math.min(score, 0);
      else if (k.latin.startsWith(lq) || k.latin.startsWith(`al${lq}`)) score = Math.min(score, 1);
      else if (k.latin.includes(lq)) score = Math.min(score, 2);
    }
    if (score < 99) scored.push({ c: k.c, score });
  }
  return scored
    .sort((x, y) => x.score - y.score || x.c.id - y.c.id)
    .slice(0, limit)
    .map((x) => x.c);
}

export interface Reference {
  surah: number;
  /** Absent when only a surah was given (e.g. "36" or "يس"). */
  ayah?: number;
}

function valid(surah: number, ayah?: number): Reference | null {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return null;
  if (ayah == null) return { surah };
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > chapters[surah - 1].verses) return null;
  return { surah, ayah };
}

/**
 * Understands "2:255", "٢:٢٥٥", "2 255", "البقرة ٢٥٥", "البقرة: 255",
 * "سورة البقرة آية 255" and a bare surah number "36".
 * Returns null for anything else or for an ayah outside the surah.
 */
export function parseReference(input: string): Reference | null {
  const q = toWesternDigits(input)
    .replace(/[\u0640\u06DD\uFD3F\uFD3E[\]()]/g, ' ')
    .trim();
  if (!q) return null;
  let m = /^(\d{1,3})\s*(?:[:：/.،,\-]\s*|\s+)(\d{1,3})$/.exec(q);
  if (m) return valid(Number(m[1]), Number(m[2]));
  m = /^(\d{1,3})$/.exec(q);
  if (m) return valid(Number(m[1]));
  m = /^(.*?[^\d\s:：،,\-])[\s:：،,\-]*(\d{1,3})$/.exec(q);
  if (m) {
    const c = surahByName(m[1]);
    return c ? valid(c.id, Number(m[2])) : null;
  }
  return null;
}

// ── Pages & positions ────────────────────────────────────────────────────

const pageStarts: [number, number][] = (meta.pageStart as string[]).map((k) => {
  const [s, a] = k.split(':').map(Number);
  return [s, a];
});

/** Mushaf page (1–604) of an ayah, without loading the surah file. */
export function pageOf(surah: number, ayah: number): number {
  let lo = 0;
  let hi = pageStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const [s, a] = pageStarts[mid];
    if (s < surah || (s === surah && a <= ayah)) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

const offsets: number[] = [];
{
  let sum = 0;
  for (const c of chapters) {
    offsets.push(sum);
    sum += c.verses;
  }
}

/** Position of an ayah in the mushaf-ordered index (0 … 6235). */
export function indexOf(surah: number, ayah: number): number {
  return offsets[surah - 1] + ayah - 1;
}
