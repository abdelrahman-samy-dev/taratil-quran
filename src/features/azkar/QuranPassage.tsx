import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { BASMALA, chapter, surahText } from '../../quran/data';

export const ISTIADHA = 'أَعُوذُ بِٱللَّهِ مِنَ ٱلشَّيۡطَٰنِ ٱلرَّجِيمِ';

/** "2:285-286" → { surah: 2, from: 285, to: 286 }; "112" → the whole surah. */
export function parsePassage(q: string): { surah: number; from: number; to: number } {
  const [s, range] = q.split(':');
  const surah = Number(s);
  if (!range) return { surah, from: 1, to: chapter(surah).verses };
  const [from, to] = range.split('-').map(Number);
  return { surah, from, to: to || from };
}

/** Plain text of a passage for copy/share, e.g. "﴿…﴾ [البقرة: ٢٥٥]". */
export async function passageText(q: string, pre?: 'a' | 'b'): Promise<string> {
  const { surah, from, to } = parsePassage(q);
  const d = await surahText(surah);
  const verses = d.v.slice(from - 1, to).map((v, i) => `${v} (${arNum(from + i)})`).join(' ');
  const lead = pre === 'a' ? `${ISTIADHA}\n` : pre === 'b' ? `${BASMALA}\n` : '';
  const ref = from === 1 && to === chapter(surah).verses ? `سورة ${chapter(surah).ar}` : `${chapter(surah).ar}: ${arNum(from)}${to > from ? `–${arNum(to)}` : ''}`;
  return `${lead}﴿${verses}﴾ [${ref}]`;
}

/** Renders a Quran passage exactly as in the mushaf text, with ornamented ayah numbers. */
export function QuranPassage({ q, pre, fallback }: { q: string; pre?: 'a' | 'b'; fallback: string }) {
  const verses = useSignal<string[] | null>(null);
  const { surah, from, to } = parsePassage(q);
  useEffect(() => {
    let alive = true;
    surahText(surah)
      .then((d) => alive && (verses.value = d.v.slice(from - 1, to)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [q]);

  if (!verses.value) return <p class="zekr-text">{fallback}</p>;
  return (
    <p class="zekr-text zekr-quran quran-text">
      {pre && <span class="zekr-quran-pre">{pre === 'a' ? ISTIADHA : BASMALA}</span>}
      {verses.value.map((v, i) => (
        <span key={i}>
          {v}
          {' '}
          <span class="ayah-num">{arNum(from + i)}</span>{' '}
        </span>
      ))}
    </p>
  );
}
