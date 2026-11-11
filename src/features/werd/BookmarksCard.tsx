import { arNum } from '../../lib/arabic';
import { chapter, chapterAtPage, parseKey, type Chapter } from '../../quran/data';
import { bookmarks, type Bookmark } from '../../state/progress';
import { Icon } from '../../ui/Icon';
import { Empty } from '../../ui/kit';
import { toast } from '../../ui/toast';

/** Known labels, in display order. Any other label is shown after them. */
export const BOOKMARK_LABELS = ['حفظ', 'تدبر', 'مراجعة', 'عام'] as const;

export function groupBookmarks(list: Bookmark[]): { label: string; items: Bookmark[] }[] {
  const map = new Map<string, Bookmark[]>();
  for (const b of list) {
    const label = b.label?.trim() || 'عام';
    const arr = map.get(label) ?? [];
    arr.push(b);
    map.set(label, arr);
  }
  const known = BOOKMARK_LABELS as readonly string[];
  const order = [...known.filter((l) => map.has(l)), ...[...map.keys()].filter((l) => !known.includes(l)).sort()];
  return order.map((label) => ({ label, items: map.get(label)!.sort((a, b) => b.at - a.at) }));
}

export function bookmarkHref(b: Bookmark): string {
  return b.key ? `/mushaf/${b.page}?k=${b.key}` : `/mushaf/${b.page}`;
}

function surahOf(b: Bookmark): Chapter {
  if (b.key) {
    const [s] = parseKey(b.key);
    if (s >= 1 && s <= 114) return chapter(s);
  }
  return chapterAtPage(b.page);
}

function removeBookmark(b: Bookmark) {
  bookmarks.value = bookmarks.value.filter((x) => x.id !== b.id);
  toast(
    'حُذفت العلامة',
    {
      label: 'تراجع',
      run: () => {
        if (!bookmarks.value.some((x) => x.id === b.id)) bookmarks.value = [...bookmarks.value, b];
      },
    },
    6000,
  );
}

export function BookmarksCard() {
  const groups = groupBookmarks(bookmarks.value);

  return (
    <section class="werd-section" aria-labelledby="werd-bm-title">
      <h2 class="section-title" id="werd-bm-title">
        <span>العلامات المحفوظة</span>
        {bookmarks.value.length > 0 && <span class="tag">{arNum(bookmarks.value.length)}</span>}
      </h2>
      {!groups.length ? (
        <div class="card">
          <Empty icon="bookmark" title="لا توجد علامات بعد">
            <p class="hint">احفظ موضعاً أثناء القراءة في المصحف لتعود إليه من هنا.</p>
            <a class="btn btn-outline" href="/mushaf">
              <Icon name="book" size={18} /> افتح المصحف
            </a>
          </Empty>
        </div>
      ) : (
        <div class="werd-bm-groups">
          {groups.map((g) => (
            <section key={g.label} class="card werd-bm-group" aria-label={`علامات ${g.label}`}>
              <h3 class="werd-bm-head">
                <Icon name="bookmarkFill" size={16} />
                <span>{g.label}</span>
                <span class="werd-bm-count">{arNum(g.items.length)}</span>
              </h3>
              <ul class="werd-bm-list">
                {g.items.map((b) => {
                  const surah = surahOf(b);
                  const name = surah.ar;
                  const ayah = b.key ? parseKey(b.key)[1] : 0;
                  return (
                    <li key={b.id} class="werd-bm">
                      <a class="werd-bm-link" href={bookmarkHref(b)}>
                        <span class="werd-bm-num" aria-hidden="true">
                          {arNum(surah.id)}
                        </span>
                        <span class="werd-bm-text">
                          <span class="werd-bm-name">سورة {name}</span>
                          <span class="werd-bm-meta">
                            صفحة {arNum(b.page)}
                            {ayah > 0 && ` · الآية ${arNum(ayah)}`}
                          </span>
                        </span>
                      </a>
                      <button
                        class="icon-btn werd-bm-del"
                        onClick={() => removeBookmark(b)}
                        aria-label={`حذف علامة سورة ${name}، صفحة ${arNum(b.page)}`}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
