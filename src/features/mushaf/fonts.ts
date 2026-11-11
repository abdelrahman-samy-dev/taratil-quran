/**
 * QCF v2 (King Fahd Complex, Madinah 1421 print) ships one font per page; each
 * word of the page is a single glyph in that font. Fonts are cached by the SW.
 */
const SOURCES = [
  (p: number) => `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${p}.woff2`,
  (p: number) => `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${p}.woff2`,
];

const loading = new Map<number, Promise<string>>();
const ready = new Set<number>();

export const isFontReady = (p: number) => ready.has(p);

export const fontFamily = (p: number) => `qcf-p${p}`;

export function loadPageFont(p: number): Promise<string> {
  const existing = loading.get(p);
  if (existing) return existing;
  const family = fontFamily(p);
  const run = (async () => {
    let lastErr: unknown;
    for (const src of SOURCES) {
      try {
        const face = new FontFace(family, `url(${src(p)}) format('woff2')`, { display: 'block' });
        await face.load();
        document.fonts.add(face);
        ready.add(p);
        return family;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  })();
  loading.set(p, run);
  run.catch(() => loading.delete(p));
  return run;
}
