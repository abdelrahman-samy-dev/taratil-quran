import { useSignal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { arNum, normalizeArabic, parseArNum } from '../lib/arabic';
import { chapters, placeLabel, type Chapter } from '../quran/data';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const index = chapters.map((c) => ({ c, key: normalizeArabic(`${c.ar} ${c.en}`) }));

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (c: Chapter) => void;
  current?: number;
  title?: string;
}

/** Searchable surah list (Arabic or transliterated name, or number). */
export function SurahPicker({ open, onClose, onPick, current, title = 'اختر السورة' }: Props) {
  const q = useSignal('');
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    q.value = '';
    requestAnimationFrame(() => list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' }));
  }, [open]);

  const items = useMemo(() => {
    const raw = q.value.trim();
    if (!raw) return chapters;
    const n = parseArNum(raw);
    if (!Number.isNaN(n)) return chapters.filter((c) => String(c.id).startsWith(String(n)));
    const nq = normalizeArabic(raw.replace(/^سوره?\s*/, ''));
    return index.filter((x) => x.key.includes(nq)).map((x) => x.c);
  }, [q.value]);

  return (
    <Sheet open={open} onClose={onClose} title={title} class="picker-sheet">
      <div class="picker-tools">
        <label class="search-field">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="اسم السورة أو رقمها…"
            value={q.value}
            onInput={(e) => (q.value = e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && items[0] && onPick(items[0])}
            aria-label="ابحث عن سورة"
            autofocus
          />
        </label>
      </div>
      <ul class="picker-list" role="listbox" aria-label="السور" ref={list}>
        {items.map((c) => (
          <li key={c.id} class={`picker-item${c.id === current ? ' selected' : ''}`} role="option" aria-selected={c.id === current}>
            <button class="picker-main surah-option" onClick={() => onPick(c)}>
              <span class="surah-option-num">{arNum(c.id)}</span>
              <span class="surah-option-text">
                <span class="picker-name display">سورة {c.ar}</span>
                <span class="picker-meta">
                  {placeLabel(c)} · {arNum(c.verses)} آية · صفحة {arNum(c.pages[0])}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!items.length && <li class="picker-empty">لا توجد سورة بهذا الاسم</li>}
      </ul>
    </Sheet>
  );
}
