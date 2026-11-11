import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import { normalizeArabic } from '../lib/arabic';
import { prefs } from '../state/prefs';
import { Icon } from '../ui/Icon';
import { ErrorState, Skeleton } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import {
  favoriteReciters,
  loadRecitations,
  recitations,
  recitationsError,
  styleLabel,
  toggleFavorite,
  type Recitation,
} from './reciters';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (r: Recitation) => void;
  /** Only show recitations that include this surah. */
  surah?: number;
}

export function ReciterPicker({ open, onClose, onPick, surah }: Props) {
  const q = useSignal('');
  const onlyTimed = useSignal(false);

  useEffect(() => {
    if (open) void loadRecitations().catch(() => {});
  }, [open]);

  const list = useMemo(() => {
    const nq = normalizeArabic(q.value);
    const fav = favoriteReciters.value;
    return recitations.value
      .filter((r) => (!surah || r.surahs.has(surah)) && (!onlyTimed.value || r.timed) && (!nq || r.search.includes(nq)))
      .sort((a, b) => {
        const fa = fav.includes(a.id) ? 0 : 1;
        const fb = fav.includes(b.id) ? 0 : 1;
        return fa - fb;
      });
  }, [recitations.value, q.value, onlyTimed.value, favoriteReciters.value, surah]);

  return (
    <Sheet open={open} onClose={onClose} title="اختر القارئ" class="picker-sheet">
      <div class="picker-tools">
        <label class="search-field">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="ابحث باسم القارئ أو الرواية…"
            value={q.value}
            onInput={(e) => (q.value = e.currentTarget.value)}
            autofocus
            aria-label="ابحث عن قارئ"
          />
        </label>
        <button
          class={`chip${onlyTimed.value ? ' active' : ''}`}
          onClick={() => (onlyTimed.value = !onlyTimed.value)}
          aria-pressed={onlyTimed.value}
          title="القراء الذين تتوفر لهم مواضع الآيات بدقة"
        >
          <Icon name="zap" size={14} /> تظليل دقيق
        </button>
      </div>
      {recitationsError.value && !recitations.value.length ? (
        <ErrorState text="تعذر تحميل القراء" onRetry={() => void loadRecitations().catch(() => {})} />
      ) : !recitations.value.length ? (
        <Skeleton lines={8} />
      ) : (
        <ul class="picker-list" role="listbox" aria-label="القراء">
          {list.map((r) => {
            const selected = r.id === prefs.value.reciter;
            const fav = favoriteReciters.value.includes(r.id);
            return (
              <li key={r.id} class={`picker-item${selected ? ' selected' : ''}`} role="option" aria-selected={selected}>
                <button class="picker-main" onClick={() => onPick(r)}>
                  <span class="picker-name">{r.name}</span>
                  <span class="picker-meta">
                    {styleLabel(r)}
                    {r.timed && (
                      <span class="tag tag-accent" title="تظليل الآية بدقة">
                        <Icon name="zap" size={11} /> دقيق
                      </span>
                    )}
                  </span>
                </button>
                <button
                  class={`icon-btn fav${fav ? ' on' : ''}`}
                  onClick={() => toggleFavorite(r.id)}
                  aria-label={fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  aria-pressed={fav}
                >
                  <Icon name="star" size={18} fill={fav} />
                </button>
              </li>
            );
          })}
          {!list.length && <li class="picker-empty">لا توجد نتائج</li>}
        </ul>
      )}
    </Sheet>
  );
}
