#!/usr/bin/env node
/**
 * One-off: converts the legacy js/data.js azkar into src/data/azkar.json,
 * cleaning the text on the way (tatweel, stray marks, spacing, typos,
 * Quran references pulled out of the text into `ref`).
 *
 *   node scripts/clean-azkar.mjs <path-to-legacy-data.js>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(process.argv[2] || join(ROOT, 'js', 'data.js'), 'utf8');
const sandbox = {};
new Function('window', `${src};`)(sandbox);
const legacy = sandbox.azkarData;

const CATEGORIES = [
  ['morning', 'أذكار الصباح', 'الصباح'],
  ['evening', 'أذكار المساء', 'المساء'],
  ['post_prayer', 'أذكار بعد الصلاة', 'بعد الصلاة'],
  ['sleep', 'أذكار النوم', 'النوم'],
  ['wakeup', 'أذكار الاستيقاظ', 'الاستيقاظ'],
  ['general', 'تسابيح وأذكار عامة', 'تسابيح'],
  ['quranic', 'أدعية قرآنية', 'أدعية قرآنية'],
  ['prophets', 'أدعية الأنبياء', 'أدعية الأنبياء'],
];

const COMBINING = /[ً-ٰٟۖ-ۭ]/;

function clean(text = '') {
  let t = text;
  // Tatweel is decorative here, except when it carries a superscript alef / Quranic mark.
  t = [...t]
    .filter((ch, i, arr) => ch !== 'ـ' || COMBINING.test(arr[i + 1] || ''))
    .join('');
  t = t.replace(/\s+([ً-ْ])/g, '$1'); // stray harakat after a space
  t = t.replace(/\s+([،,.؛:])/g, '$1'); // no space before punctuation
  t = t.replace(/([،,؛:])(?=\S)/g, '$1 '); // one space after
  t = t.replace(/\.(?=[^\s.\])\d])/g, '. '); // sentences glued together
  t = t.replace(/علية السلام/g, 'عليه السلام');
  t = t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  return t;
}

function splitRef(text) {
  // Pull trailing Quran refs like "[الأعراف - 23]" out of the text.
  const refs = [...text.matchAll(/\[([^\]]+?)\s*-\s*(\d+)\]\.?/g)].map((m) => `${m[1].trim()} ${m[2]}`);
  const body = text.replace(/\s*\[[^\]]+?\s*-\s*\d+\]\.?/g, '').trim();
  return { body, refs };
}

const out = { categories: [] };
for (const [id, title, short] of CATEGORIES) {
  const items = (legacy[id] || []).map((z) => {
    let text = clean(z.text);
    let ref = clean(z.reference).replace(/^[.\s]+|[.\s]+$/g, '').replace(/^\[|\]$/g, '');
    if (id === 'quranic' || id === 'prophets') {
      const { body, refs } = splitRef(text);
      text = body;
      if (refs.length) ref = refs.join('، ');
    }
    const item = { text, count: Math.max(1, Number(z.count) || 1) };
    const virtue = clean(z.virtue);
    if (virtue) item.virtue = virtue;
    if (ref) item.ref = ref.replace(/\s*-\s*/g, ' ');
    return item;
  });
  out.categories.push({ id, title, short, items });
}

writeFileSync(join(ROOT, 'src', 'data', 'azkar.json'), JSON.stringify(out, null, 1));
console.log(out.categories.map((c) => `${c.id}: ${c.items.length}`).join('\n'));
