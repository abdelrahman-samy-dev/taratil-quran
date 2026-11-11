import { memo } from 'preact/compat';
import { useState } from 'preact/hooks';
import { arNum, plural } from '../../lib/arabic';
import { copyText, shareText } from '../../lib/device';
import { Icon } from '../../ui/Icon';
import { Ring } from '../../ui/kit';
import type { Zekr } from './azkar-data';

interface Props {
  item: Zekr;
  index: number;
  /** Repetitions done today. */
  count: number;
  /** Category title, used when sharing. */
  title: string;
  /** `fromKeyboard` lets the page move focus to the next card for keyboard users. */
  onTap: (index: number, fromKeyboard: boolean) => void;
  onUndo: (index: number) => void;
  /** The category keeps who made the du'a in `virtue` (أدعية الأنبياء): show it as a label. */
  attribution?: boolean;
}

export function timesLabel(n: number): string {
  return plural(n, 'مرة واحدة', 'مرتان', 'مرات', 'مرة');
}

/** Ayah numbers inside the texts are stored as Western digits; show Arabic-Indic ones. */
const displayText = (s: string) => arNum(s);

function shareBody(item: Zekr): string {
  const text = displayText(item.text);
  return item.ref ? `${text}\n[${arNum(item.ref)}]` : text;
}

/**
 * One zekr. The whole card is the tap target (pointer); the ring is the real
 * button for keyboard and screen-reader users. Copy / share / undo sit in a
 * `data-nocount` toolbar so they never count.
 */
export const ZekrCard = memo(function ZekrCard({ item, index, count, title, onTap, onUndo, attribution }: Props) {
  const done = count >= item.count;
  const remaining = Math.max(0, item.count - count);
  const [open, setOpen] = useState(false);
  const compact = done && !open;

  const onClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('[data-nocount]')) return;
    // Selecting text (drag or long-press) must not count.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    if (done) setOpen((o) => !o);
    else onTap(index, e.detail === 0);
  };

  const label = done
    ? open
      ? 'تمّ هذا الذكر، اضغط لطيّ النص'
      : 'تمّ هذا الذكر، اضغط لعرض النص كاملًا'
    : `اضغط للعدّ، بقي ${arNum(remaining)} من ${arNum(item.count)}`;

  return (
    <li
      class={`zekr card${done ? ' is-done' : ''}${compact ? ' is-compact' : ''}`}
      data-index={index}
      onClick={onClick}
      // Fast repeated clicks would otherwise select a word and be ignored as a selection.
      onMouseDown={(e) => e.detail > 1 && e.preventDefault()}
    >
      {attribution && item.virtue && <p class="zekr-by">{item.virtue.replace(/\.$/, '')}</p>}
      <p class="zekr-text">{displayText(item.text)}</p>
      {!compact && !attribution && item.virtue && (
        <p class="zekr-virtue">
          <Icon name="star" size={14} />
          <span>{item.virtue}</span>
        </p>
      )}
      {!compact && item.ref && (
        <p class="zekr-ref">
          <span class="tag">{arNum(item.ref)}</span>
        </p>
      )}
      <div class="zekr-foot">
        <button type="button" class="zekr-count" aria-label={label} aria-expanded={done ? open : undefined}>
          <Ring value={Math.min(count, item.count)} max={item.count} size={52} stroke={4}>
            {done ? (
              <Icon name="check" size={22} />
            ) : (
              <span key={remaining} class="zekr-num">
                {arNum(remaining)}
              </span>
            )}
          </Ring>
        </button>
        <span class="zekr-times">{done ? 'تمّ' : timesLabel(item.count)}</span>
        <span class="zekr-tools" data-nocount>
          {count > 0 && (
            <button type="button" class="icon-btn" aria-label="تراجع عن آخر عدّة" title="تراجع" onClick={() => onUndo(index)}>
              <Icon name="minus" size={18} />
            </button>
          )}
          <button type="button" class="icon-btn" aria-label="نسخ الذكر" title="نسخ" onClick={() => void copyText(shareBody(item))}>
            <Icon name="copy" size={18} />
          </button>
          <button type="button" class="icon-btn" aria-label="مشاركة الذكر" title="مشاركة" onClick={() => void shareText(shareBody(item), title)}>
            <Icon name="share" size={18} />
          </button>
        </span>
      </div>
    </li>
  );
});
