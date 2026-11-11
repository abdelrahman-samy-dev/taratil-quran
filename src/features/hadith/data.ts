import { HttpError } from '../../lib/net';
import { normalizeArabic, stripDiacritics } from '../../lib/arabic';
import { HADITH_CACHE, editionUrl, type RawEdition, type RawGrade } from './api';
import { bookBySlug, type BookInfo } from './catalog';

export interface Hadith {
  /** Number in the edition's own numbering (may be fractional, e.g. 402.2). */
  n: number;
  /** Alternative numbering (Sahih Muslim: Abd al-Baqi, e.g. "8.01"). */
  alt?: string;
  text: string;
  grades?: RawGrade[];
  /** Index into Book.sections. */
  sec: number;
}

export interface Section {
  /** Section number in the source (the API's `reference.book`). */
  id: number;
  /** Index of the first hadith in Book.hadiths. */
  start: number;
  /** Index after the last hadith. */
  end: number;
  first: number;
  last: number;
}

export interface Book {
  info: BookInfo;
  hadiths: Hadith[];
  sections: Section[];
}

// ── Loading ───────────────────────────────────────────────────────────────

const loaded = new Map<string, Book>();
const pending = new Map<string, Promise<Book>>();

export function cachedBook(slug: string): Book | undefined {
  return loaded.get(slug);
}

/**
 * Downloads (or reads from the service-worker cache) one book with progress
 * reporting (0–1), then prepares it. Only the two most recent books stay in memory.
 */
export function loadBook(slug: string, onProgress?: (p: number) => void): Promise<Book> {
  const hit = loaded.get(slug);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(slug);
  if (inflight) return inflight;
  const info = bookBySlug(slug);
  if (!info) return Promise.reject(new Error(`Unknown book ${slug}`));

  const listeners = new Set<(p: number) => void>();
  if (onProgress) listeners.add(onProgress);
  const run = (async () => {
    const raw = await fetchText(editionUrl(slug), info.rawBytes, (p) => listeners.forEach((l) => l(p)));
    // Give the progress bar a frame to show 100% before the (synchronous) parse.
    await nextFrame();
    const data = JSON.parse(raw) as RawEdition;
    const book = prepareBook(info, data);
    loaded.set(slug, book);
    while (loaded.size > 2) loaded.delete(loaded.keys().next().value as string);
    return book;
  })();
  (run as Promise<Book> & { listen?: typeof listeners }).listen = listeners;
  pending.set(slug, run);
  run.finally(() => pending.delete(slug)).catch(() => {});
  return run;
}

/** Subscribe to the progress of a download that is already running. */
export function onBookProgress(slug: string, fn: (p: number) => void): () => void {
  const p = pending.get(slug) as (Promise<Book> & { listen?: Set<(p: number) => void> }) | undefined;
  p?.listen?.add(fn);
  return () => p?.listen?.delete(fn);
}

async function fetchText(url: string, expected: number, onProgress: (p: number) => void): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new HttpError(res.status, url);
      if (!res.body) return await res.text();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parts: string[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.byteLength;
        parts.push(decoder.decode(value, { stream: true }));
        onProgress(Math.min(0.98, got / expected));
      }
      parts.push(decoder.decode());
      onProgress(1);
      return parts.join('');
    } catch (err) {
      lastErr = err;
      if (err instanceof HttpError && err.status < 500) break;
      await new Promise((r) => setTimeout(r, 700 * 2 ** attempt));
    }
  }
  throw lastErr;
}

function nextFrame(): Promise<void> {
  return new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : r()));
}

/** Is the book's file in the service-worker cache (readable offline)? */
export async function isBookCached(slug: string): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(HADITH_CACHE);
    return !!(await cache.match(editionUrl(slug)));
  } catch {
    return false;
  }
}

// ── Preparation ───────────────────────────────────────────────────────────

/** Persian yeh/kaf → Arabic (word-final yeh keeps its undotted look as alef maqsura). */
export function arabicLetters(text: string): string {
  return text.replace(/ک/g, 'ك').replace(/ی(?=[ً-ْٰ]*(?:[^؀-ۿ]|$))/g, 'ى').replace(/ی/g, 'ي');
}

export function prepareBook(info: BookInfo, data: RawEdition): Book {
  const hadiths: Hadith[] = [];
  const refs: number[] = [];
  for (const h of data.hadiths) {
    const text = h.text?.trim();
    if (!text) continue; // a few entries have no Arabic text in this edition
    hadiths.push({
      n: h.hadithnumber,
      alt: info.altNumbering && h.arabicnumber != null ? String(h.arabicnumber) : undefined,
      text: info.persianLetters ? arabicLetters(text) : text,
      grades: h.grades?.length ? h.grades : undefined,
      sec: 0,
    });
    refs.push(h.reference?.book ?? 0);
  }
  const sections = buildSections(refs, data.metadata.sections, hadiths);
  return { info, hadiths, sections };
}

/**
 * Splits the (number-ordered) hadiths into contiguous sections using each
 * hadith's `reference.book`. The source has noise — stray 0s and the odd
 * hadith tagged with a far-away book — so a section only starts when the
 * following hadiths agree, and never goes backwards. Sets `sec` on each hadith.
 */
export function buildSections(
  refs: number[],
  names: Record<string, string>,
  hadiths: { n: number; sec: number }[],
): Section[] {
  const valid = (b: number) => b in names && (b !== 0 || !!names['0']);
  const sections: Section[] = [];
  let cur = -1;
  const LOOK = 5;
  for (let i = 0; i < refs.length; i++) {
    const b = refs[i];
    let start = false;
    if (cur === -1) {
      // First section: the first valid reference (or 0 for books without one).
      start = true;
      cur = valid(b) ? b : firstValid(refs, i, valid);
    } else if (b > cur && valid(b)) {
      let ok = true;
      for (let k = i + 1, seen = 0; k < refs.length && seen < LOOK; k++) {
        if (!valid(refs[k]) || refs[k] === 0) continue;
        seen++;
        if (refs[k] < b) {
          ok = false;
          break;
        }
      }
      if (ok) {
        cur = b;
        start = true;
      }
    }
    if (start) {
      if (sections.length) closeSection(sections[sections.length - 1], i, hadiths);
      sections.push({ id: cur, start: i, end: i, first: hadiths[i].n, last: hadiths[i].n });
    }
    hadiths[i].sec = sections.length - 1;
  }
  if (sections.length) closeSection(sections[sections.length - 1], refs.length, hadiths);
  return sections;
}

function firstValid(refs: number[], from: number, valid: (b: number) => boolean): number {
  for (let k = from; k < refs.length; k++) if (refs[k] !== 0 && valid(refs[k])) return refs[k];
  return 0;
}

function closeSection(s: Section, end: number, hadiths: { n: number }[]) {
  s.end = end;
  s.last = hadiths[end - 1].n;
}

/** Index of hadith number `n`, or of the nearest following one. -1 if past the end. */
export function indexOfNumber(hadiths: { n: number }[], n: number): number {
  let lo = 0;
  let hi = hadiths.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (hadiths[mid].n >= n) {
      ans = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  return ans;
}

/** Index of the first hadith whose alternative number (e.g. "8.01") starts with n. */
export function indexOfAltNumber(hadiths: { alt?: string }[], n: number): number {
  return hadiths.findIndex((h) => h.alt != null && Math.floor(Number.parseFloat(h.alt)) === n);
}

// ── Search ────────────────────────────────────────────────────────────────

const indexes = new WeakMap<Book, Promise<string[]>>();

/**
 * Normalised copies of every text for diacritic-insensitive search, built in
 * small slices so a big book never blocks the UI.
 */
export function searchIndex(book: Book, onProgress?: (p: number) => void): Promise<string[]> {
  let p = indexes.get(book);
  if (!p) {
    p = buildIndex(
      book.hadiths.map((h) => h.text),
      onProgress,
    );
    indexes.set(book, p);
  }
  return p;
}

export function buildIndex(texts: string[], onProgress?: (p: number) => void): Promise<string[]> {
  const out = new Array<string>(texts.length);
  let i = 0;
  return new Promise((resolve) => {
    const step = (deadline?: { timeRemaining: () => number }) => {
      const t0 = performance.now();
      const budget = () => (deadline ? deadline.timeRemaining() > 2 : performance.now() - t0 < 10);
      do {
        const end = Math.min(texts.length, i + 50);
        for (; i < end; i++) out[i] = normalizeArabic(texts[i]);
      } while (i < texts.length && budget());
      onProgress?.(texts.length ? i / texts.length : 1);
      if (i >= texts.length) resolve(out);
      else schedule(step);
    };
    schedule(step);
  });
}

function schedule(fn: (d?: { timeRemaining: () => number }) => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 120 });
  else setTimeout(fn, 0);
}

/** Normalised search terms (each must appear somewhere in the hadith). */
export function queryTerms(query: string): string[] {
  return normalizeArabic(query)
    .split(' ')
    .filter((t) => t.length > 0);
}

export function matches(normText: string, terms: string[]): boolean {
  if (!terms.length) return false;
  for (const t of terms) if (!normText.includes(t)) return false;
  return true;
}

export function search(index: string[], query: string): number[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const out: number[] = [];
  for (let i = 0; i < index.length; i++) if (matches(index[i], terms)) out.push(i);
  return out;
}

// ── Highlighting ──────────────────────────────────────────────────────────

const FOLD: Record<string, string> = {
  إ: 'ا',
  أ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ة: 'ه',
  ى: 'ي',
  ؤ: 'و',
  ئ: 'ي',
};

/**
 * Splits `text` into plain and highlighted pieces for the given normalised
 * terms. Works on the original (diacritised) text by mapping every normalised
 * character back to its position, so marks stay attached to their letters.
 */
export function highlight(text: string, terms: string[]): { t: string; hit: boolean }[] {
  if (!terms.length) return [{ t: text, hit: false }];
  let norm = '';
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!lastSpace) {
        norm += ' ';
        map.push(i);
      }
      lastSpace = true;
      continue;
    }
    if (!stripDiacritics(ch)) continue;
    norm += (FOLD[ch] ?? ch).toLowerCase();
    map.push(i);
    lastSpace = false;
  }
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(term, from);
      if (at < 0) break;
      const s = map[at];
      let e = map[at + term.length - 1] + 1;
      // Include the marks that follow the last letter.
      while (e < text.length && !stripDiacritics(text[e]) && !/\s/.test(text[e])) e++;
      ranges.push([s, e]);
      from = at + term.length;
    }
  }
  if (!ranges.length) return [{ t: text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: { t: string; hit: boolean }[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ t: text.slice(pos, s), hit: false });
    out.push({ t: text.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < text.length) out.push({ t: text.slice(pos), hit: false });
  return out;
}

/** Display clean-up: drop invisible direction marks the source sprinkles around quotes. */
export function cleanText(text: string): string {
  return text.replace(/[‎‏]/g, '').replace(/\s{2,}/g, ' ');
}
