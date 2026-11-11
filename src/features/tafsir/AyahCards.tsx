import { memo } from 'preact/compat';
import { useMemo } from 'preact/hooks';
import { playSurah } from '../../audio/player';
import { arNum } from '../../lib/arabic';
import { copyText, shareText } from '../../lib/device';
import { Icon } from '../../ui/Icon';
import { Skeleton } from '../../ui/kit';
import { ayahCitation, ayahWords, paragraphs, preview, quotePieces } from './text';

interface ReadProps {
  surah: number;
  n: number;
  verse: string;
  page: number;
  juz: number;
  /** undefined = loading, null = failed, '' = no tafsir for this ayah. */
  tafsir: string | null | undefined;
  expanded: boolean;
  onExpand: (n: number) => void;
  playing: boolean;
  flash: boolean;
}

function TafsirBody({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) {
  const all = useMemo(() => paragraphs(text), [text]);
  const short = useMemo(() => preview(all), [all]);
  const shown = expanded || !short.cut ? all : short.paras;
  return (
    <>
      {shown.map((p, i) => (
        <p key={i}>
          {quotePieces(p).map((piece, j) =>
            piece.q ? (
              <span key={j} class="tf-quote">
                ﴿{piece.t}﴾
              </span>
            ) : (
              piece.t
            ),
          )}
        </p>
      ))}
      {short.cut && (
        <button class="tf-more" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? 'طيّ التفسير' : 'تابع القراءة'}
          <Icon name="chevronDown" size={16} class={expanded ? 'flip' : undefined} />
        </button>
      )}
    </>
  );
}

/** One ayah with its tafsir and actions (tafsir mode). */
export const ReadCard = memo(function ReadCard({
  surah,
  n,
  verse,
  page,
  juz,
  tafsir,
  expanded,
  onExpand,
  playing,
  flash,
}: ReadProps) {
  const cite = () => ayahCitation(verse, surah, n);
  return (
    <article
      id={`ayah-${n}`}
      class={`tf-ayah${playing ? ' playing' : ''}${flash ? ' flash' : ''}`}
      aria-label={`الآية ${arNum(n)}`}
    >
      <div class="tf-ayah-head">
        <span class="tf-ayah-ref">
          <span class="tf-ayah-no">الآية {arNum(n)}</span>
          <span class="tf-ayah-meta">
            صفحة {arNum(page)} · الجزء {arNum(juz)}
          </span>
        </span>
        <div class="tf-actions" role="group" aria-label={`إجراءات الآية ${arNum(n)}`}>
          <button
            class="icon-btn"
            onClick={() => void playSurah(surah, { ayah: n })}
            aria-label={`استمع من الآية ${arNum(n)}`}
            title="استمع من هنا"
          >
            <Icon name="play" size={18} />
          </button>
          <a class="icon-btn" href={`/mushaf/${page}?k=${surah}:${n}`} aria-label="افتح في المصحف" title="افتح في المصحف">
            <Icon name="book" size={19} />
          </a>
          <button class="icon-btn" onClick={() => void copyText(cite(), 'نُسخت الآية')} aria-label="انسخ الآية" title="نسخ">
            <Icon name="copy" size={18} />
          </button>
          <button class="icon-btn" onClick={() => void shareText(cite())} aria-label="شارك الآية" title="مشاركة">
            <Icon name="share" size={18} />
          </button>
        </div>
      </div>

      <p class="quran-text tf-verse">
        {verse} <span class="ayah-num">{arNum(n)}</span>
      </p>

      <div class="tf-body">
        {tafsir === undefined ? (
          <Skeleton lines={3} />
        ) : tafsir === null ? (
          <p class="tf-missing">التفسير غير متاح الآن.</p>
        ) : tafsir === '' ? (
          <p class="tf-missing">لم يرد في هذا الكتاب تفسير مستقل لهذه الآية، وقد يكون ضمن تفسير آية مجاورة.</p>
        ) : (
          <TafsirBody text={tafsir} expanded={expanded} onToggle={() => onExpand(n)} />
        )}
      </div>
    </article>
  );
});

interface HifzProps {
  n: number;
  verse: string;
  revealed: boolean;
  hint: boolean;
  onToggle: (n: number) => void;
  playing: boolean;
  flash: boolean;
}

/** One ayah in hifz (تسميع) mode: masked until tapped. */
export const HifzCard = memo(function HifzCard({ n, verse, revealed, hint, onToggle, playing, flash }: HifzProps) {
  const words = useMemo(() => ayahWords(verse), [verse]);
  return (
    <button
      id={`ayah-${n}`}
      class={`tf-ayah hz${revealed ? ' open' : ''}${playing ? ' playing' : ''}${flash ? ' flash' : ''}`}
      onClick={() => onToggle(n)}
      aria-pressed={revealed}
      aria-label={revealed ? `الآية ${arNum(n)} ظاهرة، اضغط لإخفائها` : `الآية ${arNum(n)} مخفية، اضغط لإظهارها`}
    >
      <span class="quran-text tf-verse" aria-hidden={revealed ? undefined : 'true'}>
        {revealed
          ? verse
          : words.map((w, i) => {
              const show = hint && i === 0;
              return (
                <span key={i}>
                  {i > 0 && ' '}
                  <span class={show ? 'hz-hint' : w.mark ? 'hz-w hz-mark' : 'hz-w'}>{w.t}</span>
                </span>
              );
            })}{' '}
        <span class="ayah-num">{arNum(n)}</span>
      </span>
      {!revealed && (
        <span class="hz-tap" aria-hidden="true">
          <Icon name="eye" size={16} />
        </span>
      )}
    </button>
  );
});
