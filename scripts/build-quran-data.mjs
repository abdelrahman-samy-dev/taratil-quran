#!/usr/bin/env node
/**
 * Builds the static Quran data the app ships with (public/data/**).
 *
 * Source: Quran.com API v4 (public, no key). Run once; output is committed so
 * the app never depends on this API at runtime for text or mushaf layout.
 *
 *   node scripts/build-quran-data.mjs            # everything
 *   node scripts/build-quran-data.mjs --only=mushaf
 *
 * Outputs
 *   src/data/chapters.json            114 surahs metadata (bundled)
 *   public/data/quran/text/{n}.json   { v: [uthmani text per ayah], p: [page per ayah], j: [juz per ayah] }
 *   public/data/quran/search.json     [[surah, ayah, imlaei text]] for full-text search
 *   src/data/quran-meta.json          juz / hizb-quarter / sajdah / page index (bundled)
 *   public/data/mushaf/{p}.json       QCF v2 line layout for page p (1..604)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data');
const SRC_DATA = join(ROOT, 'src', 'data'); // small, bundled with the app
const API = 'https://api.quran.com/api/v4';
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];

async function get(url, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.ok) return await res.json();
      if (res.status < 500 && res.status !== 429) throw new Error(`${res.status} ${url}`);
    } catch (err) {
      if (i === tries) throw err;
    }
    await new Promise((r) => setTimeout(r, 600 * i));
  }
  throw new Error(`failed ${url}`);
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function save(rel, data, base = OUT) {
  const file = join(base, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ── Chapters ──────────────────────────────────────────────────────────────
async function buildChapters() {
  const { chapters } = await get(`${API}/chapters?language=ar`);
  const out = chapters.map((c) => ({
    id: c.id,
    ar: c.name_arabic,
    en: c.name_simple,
    place: c.revelation_place === 'madinah' ? 'madinah' : 'makkah',
    order: c.revelation_order,
    verses: c.verses_count,
    pages: c.pages,
    bismillah: c.bismillah_pre,
  }));
  await save('chapters.json', out, SRC_DATA);
  console.log('chapters ✓', out.length);
  return out;
}

// ── Mushaf pages (QCF v2 layout) + per-verse page/juz index ──────────────
// by_page drops verses at random on the API side, so collect words per chapter
// (reliable, paginated) and group them by page ourselves. Everything is verified.
async function fetchChapterVerses(c) {
  const verses = [];
  for (let page = 1; ; page++) {
    const url =
      `${API}/verses/by_chapter/${c.id}?words=true&per_page=50&page=${page}` +
      `&word_fields=code_v2,line_number,page_number,char_type_name`;
    const j = await get(url);
    verses.push(...j.verses);
    if (!j.pagination.next_page) break;
  }
  if (verses.length !== c.verses) throw new Error(`surah ${c.id}: ${verses.length}/${c.verses} verses`);
  return verses;
}

async function buildPages(chapters) {
  const verseInfo = new Map(); // key -> { page, juz, hizb, rub, sajdah }
  const byPage = Array.from({ length: 605 }, () => ({ keys: [], words: [] }));
  const all = await pool(chapters, 6, fetchChapterVerses);
  for (const verses of all) {
    for (const v of verses) {
      verseInfo.set(v.verse_key, {
        page: v.page_number,
        juz: v.juz_number,
        hizb: v.hizb_number,
        rub: v.rub_el_hizb_number,
        sajdah: v.sajdah_number != null,
      });
      for (const w of v.words) {
        const bucket = byPage[w.page_number];
        if (bucket.keys[bucket.keys.length - 1] !== v.verse_key) bucket.keys.push(v.verse_key);
        bucket.words.push({ ...w, vi: bucket.keys.length - 1, key: v.verse_key });
      }
    }
  }
  const pages = [];
  for (let p = 1; p <= 604; p++) {
    const keys = byPage[p].keys;
    const lines = new Map(); // line -> words
    for (const w of byPage[p].words) {
      const t = w.char_type_name === 'end' ? 1 : 0; // 1 = ayah-number marker
      if (!lines.has(w.line_number)) lines.set(w.line_number, []);
      lines.get(w.line_number).push([w.code_v2, w.vi, t]);
    }

    // Lines with no words are surah headers / basmala. Work out which.
    const used = [...lines.keys()].sort((a, b) => a - b);
    const maxLine = p <= 2 ? Math.max(...used) : 15;
    const firstVerseOfLine = (ln) => keys[lines.get(ln)[0][1]];
    const out = [];
    const pendingEmpty = [];
    const flushEmpty = (nextSurah, trailing = false) => {
      // Fill empty lines that precede a surah start: [header, basmala] pattern.
      const n = pendingEmpty.length;
      if (!n) return;
      const needsBasmala = nextSurah !== 1 && nextSurah !== 9;
      pendingEmpty.forEach((ln, i) => {
        if (trailing) {
          out.push({ n: ln, t: i === 0 || !needsBasmala ? 's' : 'b', s: nextSurah });
          return;
        }
        const isLast = i === n - 1;
        if (needsBasmala && isLast && n >= 2) out.push({ n: ln, t: 'b', s: nextSurah });
        else if (needsBasmala && n === 1) out.push({ n: ln, t: 'b', s: nextSurah });
        else out.push({ n: ln, t: 's', s: nextSurah });
      });
      pendingEmpty.length = 0;
    };
    for (let ln = 1; ln <= maxLine; ln++) {
      if (!lines.has(ln)) {
        pendingEmpty.push(ln);
        continue;
      }
      const [s, a] = firstVerseOfLine(ln).split(':').map(Number);
      if (pendingEmpty.length) flushEmpty(a === 1 ? s : s);
      out.push({ n: ln, t: 'a', w: lines.get(ln) });
    }
    if (pendingEmpty.length) {
      // Trailing empty lines: header (+ basmala) of the surah that starts on the next page.
      const lastKey = keys[keys.length - 1];
      const nextSurah = Number(lastKey.split(':')[0]) + 1;
      flushEmpty(nextSurah, true);
    }
    if (p > 2 && out.length !== 15) throw new Error(`page ${p}: ${out.length} lines`);
    const first = verseInfo.get(keys[0]);
    const page = { p, juz: first.juz, hizb: first.hizb, rub: first.rub, k: keys, l: out };
    await save(`mushaf/${p}.json`, page);
    pages.push(page);
  }
  console.log('mushaf ✓', pages.length);
  return { pages, verseInfo };
}

// ── Text per surah + search + meta ───────────────────────────────────────
async function buildText(chapters, verseInfo) {
  const search = [];
  await pool(chapters, 6, async (c) => {
    const [u, im] = await Promise.all([
      get(`${API}/quran/verses/uthmani?chapter_number=${c.id}`),
      get(`${API}/quran/verses/imlaei?chapter_number=${c.id}`),
    ]);
    const v = u.verses.map((x) => x.text_uthmani);
    const p = u.verses.map((x) => verseInfo.get(x.verse_key)?.page ?? 0);
    const j = u.verses.map((x) => verseInfo.get(x.verse_key)?.juz ?? 0);
    await save(`quran/text/${c.id}.json`, { id: c.id, v, p, j });
    im.verses.forEach((x, i) => (search[c.id * 1000 + i] = [c.id, i + 1, x.text_imlaei]));
  });
  await save('quran/search.json', search.filter(Boolean));
  console.log('text + search ✓');
}

function buildMeta(pages, verseInfo) {
  const juz = [];
  const quarters = [];
  const sajdah = [];
  // Walk pages (and their verses) in mushaf order so the first hit is the start.
  for (const pg of pages) {
    for (const key of pg.k) {
      const info = verseInfo.get(key);
      if (!juz[info.juz - 1]) juz[info.juz - 1] = { juz: info.juz, page: info.page, key };
      if (!quarters[info.rub - 1]) quarters[info.rub - 1] = { rub: info.rub, hizb: info.hizb, page: info.page, key };
      if (info.sajdah) sajdah.push(key);
    }
  }
  const pageStart = pages.map((pg) => pg.k[0]);
  return save('quran-meta.json', { juz, quarters, sajdah, pageStart }, SRC_DATA);
}

const t0 = Date.now();
const chapters = await buildChapters();
if (only !== 'chapters') {
  const { pages, verseInfo } = await buildPages(chapters);
  await buildMeta(pages, verseInfo);
  console.log('meta ✓');
  if (only !== 'mushaf') await buildText(chapters, verseInfo);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
