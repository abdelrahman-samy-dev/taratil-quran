import { useSignal } from '@preact/signals';
import type { VNode } from 'preact';
import { memo } from 'preact/compat';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { arNum, normalizeArabic, plural } from '../../lib/arabic';
import { fetchJSON } from '../../lib/net';
import { persisted } from '../../lib/storage';
import { chapter, placeLabel, type Chapter } from '../../quran/data';
import { Icon } from '../../ui/Icon';
import { Empty, ErrorState, PageHeader, Skeleton } from '../../ui/kit';
import {
  MIN_QUERY,
  buildIndex,
  highlight,
  indexOf,
  letterCount,
  matchSurahs,
  pageOf,
  parseReference,
  searchIndex,
  type Entry,
  type Row,
} from './engine';
import './search.css';

const PAGE = 50;
/** Results painted right away; the rest of the page follows a frame later. */
const FIRST_PAINT = 12;
const DEBOUNCE = 200;
const RECENT_MAX = 8;
const EXAMPLES = ['الصبر', 'رب اشرح لي صدري', '٢:٢٥٥', 'الكهف'];

const recent = persisted<string[]>('search:recent', []);

function remember(q: string) {
  const t = q.trim();
  if (letterCount(t) < 1 && !/\d/.test(t)) return;
  const key = normalizeArabic(t);
  recent.value = [t, ...recent.value.filter((r) => normalizeArabic(r) !== key)].slice(0, RECENT_MAX);
}

// The index lives for the session once built (≈6k short strings).
let indexPromise: Promise<Entry[]> | null = null;
function loadIndex(): Promise<Entry[]> {
  indexPromise ??= fetchJSON<Row[]>('/data/quran/search.json', { memo: false, timeout: 30_000 })
    .then((rows) => buildIndex(rows))
    .catch((err: unknown) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
}

const mushafHref = (s: number, a: number) => `/mushaf/${pageOf(s, a)}?k=${s}:${a}`;
const tafsirHref = (s: number, a: number) => `/tafsir/${s}?a=${a}`;

export default function SearchPage() {
  const { query } = useRoute();
  const { route } = useLocation();
  const q = useSignal(query.q ?? '');
  const dq = useSignal(q.value);
  const index = useSignal<Entry[] | null>(null);
  const failed = useSignal(false);
  const attempt = useSignal(0);
  const shown = useSignal(PAGE);
  const filled = useSignal(true);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    failed.value = false;
    loadIndex()
      .then((ix) => live && (index.value = ix))
      .catch(() => live && (failed.value = true));
    return () => {
      live = false;
    };
  }, [attempt.value]);

  // Focus after the shell has moved focus to <main> for the new page.
  useEffect(() => {
    const id = requestAnimationFrame(() => setTimeout(() => input.current?.focus({ preventScroll: true }), 0));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (q.value === dq.value) return;
    const t = setTimeout(() => (dq.value = q.value), DEBOUNCE);
    return () => clearTimeout(t);
  }, [q.value]);

  // The URL changed from outside (topbar search link, history): follow it.
  useEffect(() => {
    const ext = query.q ?? '';
    if (ext.trim() !== dq.value.trim()) {
      q.value = ext;
      dq.value = ext;
    }
  }, [query.q]);

  // Keep the query in the URL so "back" from the mushaf / tafsir restores the results.
  useEffect(() => {
    shown.value = PAGE;
    filled.value = false;
    const t = dq.value.trim();
    route(t ? `/search?q=${encodeURIComponent(t)}` : '/search', true);
    const id = setTimeout(() => (filled.value = true), 60);
    return () => clearTimeout(id);
  }, [dq.value]);

  const term = dq.value.trim();
  const ref = useMemo(() => parseReference(term), [term]);
  const surahs = useMemo(() => {
    const list = matchSurahs(term);
    if (ref && !ref.ayah && !list.some((c) => c.id === ref.surah)) list.unshift(chapter(ref.surah));
    return list;
  }, [term, ref]);
  const result = useMemo(() => (index.value ? searchIndex(index.value, term) : null), [index.value, term]);
  const tooShort = !!term && letterCount(term) < MIN_QUERY;

  const hits = result ? [...result.exact, ...result.loose] : [];
  const total = hits.length;
  const visible = hits.slice(0, filled.value ? shown.value : Math.min(shown.value, FIRST_PAINT));
  const looseFrom = result ? result.exact.length : 0;

  const rows: VNode[] = [];
  visible.forEach((i, k) => {
    if (k === looseFrom && looseFrom > 0) {
      rows.push(
        <li key="loose" class="sr-divider" role="presentation">
          آيات فيها الكلمات نفسها بترتيب آخر
        </li>,
      );
    }
    rows.push(<Result key={i} e={index.value![i]} terms={k >= looseFrom ? result!.terms : [result!.phrase]} />);
  });

  const onPick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) remember(term);
  };

  return (
    <div class="sr-page">
      <PageHeader title="البحث في القرآن" subtitle="في آيات القرآن الكريم كلها، بالكلمة أو اسم السورة أو رقم الآية" />

      <form
        role="search"
        class="sr-form"
        onSubmit={(e) => {
          e.preventDefault();
          dq.value = q.value;
          remember(q.value);
          input.current?.blur();
        }}
      >
        <label class="search-field sr-field">
          <Icon name="search" size={20} />
          <input
            ref={input}
            type="search"
            dir="rtl"
            enterKeyHint="search"
            autoComplete="off"
            spellcheck={false}
            placeholder="كلمة، آية، سورة، أو ٢:٢٥٥"
            aria-label="ابحث في القرآن"
            value={q.value}
            onInput={(e) => (q.value = e.currentTarget.value)}
          />
          {q.value && (
            <button
              type="button"
              class="icon-btn sr-clear"
              aria-label="امسح البحث"
              onClick={() => {
                q.value = '';
                dq.value = '';
                input.current?.focus();
              }}
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </label>
      </form>

      {!term ? (
        <Start
          onPick={(t) => {
            q.value = t;
            dq.value = t;
            remember(t);
          }}
        />
      ) : (
        <div class="sr-results" onClick={onPick}>
          {ref?.ayah && <Jump surah={ref.surah} ayah={ref.ayah} entry={index.value?.[indexOf(ref.surah, ref.ayah)]} />}

          {surahs.length > 0 && (
            <section aria-label="السور المطابقة">
              <h2 class="section-title sr-title">السور</h2>
              <ul class="sr-surahs">
                {surahs.map((c) => (
                  <SurahRow key={c.id} c={c} />
                ))}
              </ul>
            </section>
          )}

          {failed.value ? (
            <ErrorState text="تعذّر تحميل فهرس البحث. تحقّق من الاتصال ثم أعد المحاولة." onRetry={() => attempt.value++} />
          ) : tooShort ? (
            !ref && !surahs.length && <p class="hint sr-note">اكتب حرفين على الأقل للبحث في الآيات.</p>
          ) : !index.value ? (
            <section aria-busy="true" aria-label="جارٍ تجهيز البحث">
              <p class="hint sr-note">جارٍ تجهيز فهرس البحث…</p>
              <Skeleton lines={4} />
            </section>
          ) : total === 0 && (ref || surahs.length) ? null : (
            <section aria-label="نتائج الآيات">
              <div class="sr-head">
                <h2 class="section-title sr-title">الآيات</h2>
                <span class="sr-count" role="status">
                  {total ? plural(total, 'نتيجة واحدة', 'نتيجتان', 'نتائج', 'نتيجة') : 'لا نتائج'}
                </span>
              </div>
              {total === 0 ? (
                <Empty icon="search" title="لا توجد آيات بهذا النص">
                  <p class="hint">جرّب كلمة أخرى، أو جزءًا من الكلمة دون «ال».</p>
                </Empty>
              ) : (
                <ol class="sr-list">{rows}</ol>
              )}
              {filled.value && total > visible.length && (
                <button class="btn btn-ghost btn-block sr-more" onClick={() => (shown.value += PAGE)}>
                  عرض المزيد ({arNum(Math.min(PAGE, total - visible.length))} من {arNum(total - visible.length)})
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Start({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div class="sr-start">
      {recent.value.length > 0 && (
        <section aria-label="عمليات البحث الأخيرة">
          <div class="sr-head">
            <h2 class="section-title sr-title">آخر عمليات البحث</h2>
            <button class="btn btn-ghost btn-sm sr-clear-all" onClick={() => (recent.value = [])}>
              <Icon name="trash" size={16} /> مسح
            </button>
          </div>
          <ul class="sr-chips">
            {recent.value.map((r) => (
              <li key={r}>
                <button class="chip sr-chip" onClick={() => onPick(r)}>
                  <Icon name="clock" size={15} />
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="أمثلة">
        <h2 class="section-title sr-title">جرّب مثلًا</h2>
        <ul class="sr-chips">
          {EXAMPLES.map((r) => (
            <li key={r}>
              <button class="chip sr-chip" onClick={() => onPick(r)}>
                {r}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Jump({ surah, ayah, entry }: { surah: number; ayah: number; entry?: Entry }) {
  const c = chapter(surah);
  return (
    <section class="sr-jump" aria-label="انتقال مباشر">
      <span class="sr-jump-kicker">
        <Icon name="target" size={16} /> انتقال مباشر
      </span>
      <h2 class="sr-jump-title display">
        سورة {c.ar} · الآية {arNum(ayah)}
      </h2>
      {entry ? <p class="quran-text sr-text">{entry.t}</p> : <Skeleton lines={1} />}
      <div class="sr-actions">
        <a class="btn" href={mushafHref(surah, ayah)}>
          <Icon name="book" size={18} /> في المصحف
        </a>
        <a class="btn btn-outline" href={tafsirHref(surah, ayah)}>
          <Icon name="scroll" size={18} /> التفسير
        </a>
      </div>
    </section>
  );
}

function SurahRow({ c }: { c: Chapter }) {
  return (
    <li class="sr-surah">
      <span class="surah-option-num">{arNum(c.id)}</span>
      <span class="sr-surah-text">
        <span class="sr-surah-name display">سورة {c.ar}</span>
        <span class="sr-surah-meta">
          {placeLabel(c)} · {plural(c.verses, 'آية واحدة', 'آيتان', 'آيات', 'آية')} · صفحة {arNum(c.pages[0])}
        </span>
      </span>
      <span class="sr-surah-acts">
        <a class="sr-act" href={`/mushaf/${c.pages[0]}`} aria-label={`افتح سورة ${c.ar} في المصحف`}>
          <Icon name="book" size={18} />
          <span>المصحف</span>
        </a>
        <a class="sr-act" href={`/tafsir/${c.id}`} aria-label={`تفسير سورة ${c.ar}`}>
          <Icon name="scroll" size={18} />
          <span>التفسير</span>
        </a>
      </span>
    </li>
  );
}

const Result = memo(function Result({ e, terms }: { e: Entry; terms: string[] }) {
  const key = terms.join('|');
  const segs = useMemo(() => highlight(e.t, terms), [e, key]);
  const name = chapter(e.s).ar;
  return (
    <li class="sr-item">
      <p class="quran-text sr-text">{segs.map((s, i) => (s.m ? <mark key={i}>{s.t}</mark> : s.t))}</p>
      <div class="sr-foot">
        <span class="sr-ref">
          {name} · {arNum(e.a)}
        </span>
        <span class="sr-item-acts">
          <a class="sr-act" href={mushafHref(e.s, e.a)} aria-label={`سورة ${name} الآية ${arNum(e.a)} في المصحف`}>
            <Icon name="book" size={18} />
            <span>في المصحف</span>
          </a>
          <a class="sr-act" href={tafsirHref(e.s, e.a)} aria-label={`تفسير سورة ${name} الآية ${arNum(e.a)}`}>
            <Icon name="scroll" size={18} />
            <span>التفسير</span>
          </a>
        </span>
      </div>
    </li>
  );
});
