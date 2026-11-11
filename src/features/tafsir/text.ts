/**
 * Pure helpers for the tafsir screen (formatting, hifz order, citation).
 * Kept free of DOM and network code so they are unit-tested.
 */
import { arNum } from '../../lib/arabic';
import { chapter } from '../../quran/data';

/** "﴿…﴾ [البقرة: ٢٥٥]" — the one citation format for copy and share. */
export function ayahCitation(text: string, surah: number, ayah: number): string {
  return `﴿${text.trim()}﴾ [${chapter(surah).ar}: ${arNum(ayah)}]`;
}

export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.8;
export const SCALE_STEP = 0.1;

/** Clamp a Quran text scale to 0.8–1.8 and round away float noise. */
export function clampScale(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) * 10) / 10;
}

const OPEN = '{(«[';
const CLOSE = '})»]';
const ARABIC_LETTER = /[\u0621-\u064A]/;

/**
 * Tafsir sources send each ayah as one long block. Split it into readable
 * paragraphs at sentence ends (never inside quotes or brackets), and add the
 * missing space in ".وقد" style joins. The words themselves are untouched.
 */
export function paragraphs(text: string, min = 380): string[] {
  const src = text.replace(/\r/g, '').trim();
  if (!src) return [];
  const out: string[] = [];
  for (const block of src.split(/\n+/)) {
    let depth = 0;
    let buf = '';
    for (let i = 0; i < block.length; i++) {
      const ch = block[i];
      if (OPEN.includes(ch)) depth++;
      else if (CLOSE.includes(ch) && depth > 0) depth--;
      buf += ch;
      const end = ch === '.' || ch === '؟' || ch === '!';
      if (!end) continue;
      const next = block[i + 1] ?? '';
      if (next === '.') continue; // ". ." ellipsis inside quotations
      const joined = ARABIC_LETTER.test(next);
      if (depth === 0 && buf.trim().length >= min && (next === ' ' || joined)) {
        out.push(buf.trim());
        buf = '';
      } else if (joined) {
        buf += ' ';
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}

export interface Piece {
  t: string;
  /** A Quran quotation written as {…} in the source. */
  q: boolean;
}

/** Splits a paragraph into text and {Quran quotation} pieces. */
export function quotePieces(p: string): Piece[] {
  const out: Piece[] = [];
  const re = /\{([^{}]{1,800})\}/g;
  let pos = 0;
  for (let m = re.exec(p); m; m = re.exec(p)) {
    if (m.index > pos) out.push({ t: p.slice(pos, m.index), q: false });
    out.push({ t: m[1].trim(), q: true });
    pos = m.index + m[0].length;
  }
  if (pos < p.length) out.push({ t: p.slice(pos), q: false });
  return out.length ? out : [{ t: p, q: false }];
}

/**
 * First part of a long tafsir: whole paragraphs up to `budget` characters, or
 * the first paragraph cut at a word boundary. `cut` tells whether anything is hidden.
 */
export function preview(paras: readonly string[], budget = 700): { paras: string[]; cut: boolean } {
  const total = paras.reduce((n, p) => n + p.length, 0);
  if (total <= budget * 1.6) return { paras: [...paras], cut: false };
  const out: string[] = [];
  let used = 0;
  for (const p of paras) {
    if (out.length && used + p.length > budget) break;
    if (p.length > budget * 1.4) {
      const at = p.lastIndexOf(' ', budget);
      out.push(`${p.slice(0, at > budget / 2 ? at : budget).trim()}…`);
      used = budget;
      break;
    }
    out.push(p);
    used += p.length;
  }
  return { paras: out, cut: true };
}

/**
 * Hifz: the ayah "أظهر التالية" reveals — the first hidden one after `after`,
 * wrapping to the start of the surah. 0 when everything is revealed.
 */
export function nextHidden(total: number, revealed: ReadonlySet<number>, after: number): number {
  for (let n = after + 1; n <= total; n++) if (!revealed.has(n)) return n;
  for (let n = 1; n <= Math.min(after, total); n++) if (!revealed.has(n)) return n;
  return 0;
}

const MARK_ONLY = /^[\u06D6-\u06ED\u0615-\u061A]+$/;

export interface Word {
  t: string;
  /** Waqf/pause sign standing alone between words. */
  mark: boolean;
}

/** Ayah words for the hifz mask (pause signs are kept as their own items). */
export function ayahWords(verse: string): Word[] {
  return verse
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ t, mark: MARK_ONLY.test(t) }));
}
