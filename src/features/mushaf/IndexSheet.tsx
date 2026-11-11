import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import meta from '../../data/quran-meta.json';
import { arNum, normalizeArabic, parseArNum } from '../../lib/arabic';
import { chapter, chapterAtPage, chapters, parseKey, placeLabel } from '../../quran/data';
import { bookmarks } from '../../state/progress';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';

type Tab = 'surah' | 'juz' | 'marks';

interface Props {
  open: boolean;
  onClose: () => void;
  onGo: (page: number, key?: string) => void;
  page: number;
}

const surahIndex = chapters.map((c) => ({ c, key: normalizeArabic(`${c.ar} ${c.en}`) }));

export function IndexSheet({ open, onClose, onGo, page }: Props) {
  const tab = useSignal<Tab>('surah');
  const q = useSignal('');
  const jump = useSignal('');
  const current = chapterAtPage(page).id;

  useEffect(() => {
    if (!open) return;
    q.value = '';
    jump.value = '';
    requestAnimationFrame(() => document.querySelector('.ix-list .selected')?.scrollIntoView({ block: 'center' }));
  }, [open, tab.value]);

  const surahs = useMemo(() => {
    const nq = normalizeArabic(q.value);
    if (!nq) return chapters;
    const n = parseArNum(q.value);
    if (!Number.isNaN(n)) return chapters.filter((c) => String(c.id).startsWith(String(n)));
    return surahIndex.filter((x) => x.key.includes(nq)).map((x) => x.c);
  }, [q.value]);

  const go = (p: number, key?: string) => {
    onGo(p, key);
    onClose();
  };

  const goJump = () => {
    const n = parseArNum(jump.value);
    if (n >= 1 && n <= 604) go(n);
  };

  return (
    <Sheet open={open} onClose={onClose} title="فهرس المصحف" class="index-sheet">
      <div class="ix-head">
        <Segmented<Tab>
          label="الفهرس"
          value={tab.value}
          onChange={(v) => (tab.value = v)}
          options={[
            { value: 'surah', label: 'السور' },
            { value: 'juz', label: 'الأجزاء' },
            { value: 'marks', label: `العلامات${bookmarks.value.length ? ` (${arNum(bookmarks.value.length)})` : ''}` },
          ]}
        />
        <form
          class="ix-jump"
          onSubmit={(e) => {
            e.preventDefault();
            goJump();
          }}
        >
          <input
            class="input"
            inputMode="numeric"
            placeholder="رقم الصفحة"
            value={jump.value}
            onInput={(e) => (jump.value = e.currentTarget.value)}
            aria-label="انتقل إلى صفحة"
          />
          <button class="btn btn-sm" type="submit">
            انتقال
          </button>
        </form>
      </div>

      {tab.value === 'surah' && (
        <>
          <label class="search-field ix-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="ابحث عن سورة…"
              value={q.value}
              onInput={(e) => (q.value = e.currentTarget.value)}
              aria-label="ابحث عن سورة"
            />
          </label>
          <ul class="ix-list picker-list">
            {surahs.map((c) => (
              <li key={c.id} class={`picker-item${c.id === current ? ' selected' : ''}`}>
                <button class="picker-main surah-option" onClick={() => go(c.pages[0], `${c.id}:1`)}>
                  <span class="surah-option-num">{arNum(c.id)}</span>
                  <span class="surah-option-text">
                    <span class="picker-name display">سورة {c.ar}</span>
                    <span class="picker-meta">
                      {placeLabel(c)} · {arNum(c.verses)} آية
                    </span>
                  </span>
                  <span class="ix-page">{arNum(c.pages[0])}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab.value === 'juz' && (
        <ul class="ix-list ix-juz">
          {meta.juz.map((j) => {
            const [s, a] = parseKey(j.key);
            const active = page >= j.page && (meta.juz[j.juz]?.page ?? 605) > page;
            return (
              <li key={j.juz}>
                <button class={`ix-juz-item${active ? ' selected' : ''}`} onClick={() => go(j.page, j.key)}>
                  <span class="ix-juz-num">{arNum(j.juz)}</span>
                  <span class="surah-option-text">
                    <span class="picker-name">الجزء {arNum(j.juz)}</span>
                    <span class="picker-meta">
                      من سورة {chapter(s).ar} · الآية {arNum(a)}
                    </span>
                  </span>
                  <span class="ix-page">{arNum(j.page)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tab.value === 'marks' &&
        (bookmarks.value.length ? (
          <ul class="ix-list picker-list">
            {bookmarks.value.map((b) => {
              const c = b.key ? chapter(parseKey(b.key)[0]) : chapterAtPage(b.page);
              return (
                <li key={b.id} class="picker-item">
                  <button class="picker-main surah-option" onClick={() => go(b.page, b.key)}>
                    <span class="surah-option-num">
                      <Icon name="bookmarkFill" size={16} />
                    </span>
                    <span class="surah-option-text">
                      <span class="picker-name">
                        سورة {c.ar}
                        {b.key ? ` · الآية ${arNum(parseKey(b.key)[1])}` : ''}
                      </span>
                      <span class="picker-meta">
                        <span class="tag tag-primary">{b.label}</span> صفحة {arNum(b.page)}
                      </span>
                    </span>
                  </button>
                  <button
                    class="icon-btn"
                    aria-label="حذف العلامة"
                    onClick={() => (bookmarks.value = bookmarks.value.filter((x) => x.id !== b.id))}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="hint center ix-empty">لا توجد علامات بعد. اضغط على أي آية في المصحف لحفظ علامة عليها.</p>
        ))}
    </Sheet>
  );
}
