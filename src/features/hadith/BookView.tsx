import { useSignal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { arNum, normalizeArabic, parseArNum } from '../../lib/arabic';
import { bytes } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Empty, ErrorState, PageHeader, Progress } from '../../ui/kit';
import { toast } from '../../ui/toast';
import { bookBySlug, type BookInfo } from './catalog';
import {
  cachedBook,
  indexOfAltNumber,
  indexOfNumber,
  loadBook,
  onBookProgress,
  queryTerms,
  search,
  searchIndex,
  type Book,
} from './data';
import { compilerLine, hadithCount, lastRead, num, rangeLabel, sectionLabel } from './format';
import { HadithCard } from './HadithCard';

const PAGE = 20;

export function BookView({ slug }: { slug: string }) {
  const info = bookBySlug(slug);
  if (!info) {
    return (
      <Empty icon="library" title="هذا الكتاب غير متوفر">
        <a class="btn" href="/hadith">
          كل كتب الحديث
        </a>
      </Empty>
    );
  }
  return <BookLoader key={slug} info={info} />;
}

function BookLoader({ info }: { info: BookInfo }) {
  const book = useSignal<Book | null>(cachedBook(info.slug) ?? null);
  const progress = useSignal(0);
  const failed = useSignal(false);

  const load = () => {
    failed.value = false;
    progress.value = 0;
    let alive = true;
    const unsub = onBookProgress(info.slug, (p) => alive && (progress.value = p));
    loadBook(info.slug, (p) => alive && (progress.value = p))
      .then((b) => alive && (book.value = b))
      .catch(() => alive && (failed.value = true));
    return () => {
      alive = false;
      unsub();
    };
  };

  useEffect(() => (book.value ? undefined : load()), []);

  const header = (
    <>
      <a class="hadith-back" href="/hadith">
        <Icon name="chevronRight" size={18} /> كل كتب الحديث
      </a>
      <PageHeader title={info.name} subtitle={`${compilerLine(info)} · ${hadithCount(info.count)}`} />
    </>
  );

  if (book.value) {
    return (
      <div class="hadith-page">
        {header}
        <Reader book={book.value} />
      </div>
    );
  }
  return (
    <div class="hadith-page">
      {header}
      {failed.value ? (
        <ErrorState text="تعذر تحميل الكتاب. تأكد من الاتصال بالإنترنت ثم أعد المحاولة." onRetry={load} />
      ) : (
        <div class="hd-book-loading card" role="status" aria-live="polite">
          <Icon name="library" size={28} class="hd-book-loading-icon" />
          <p class="hd-book-loading-title">
            {progress.value >= 1 ? 'جارٍ تجهيز الكتاب…' : `جارٍ تنزيل الكتاب… ${arNum(Math.round(progress.value * 100))}٪`}
          </p>
          <Progress value={progress.value} max={1} label="تقدم التنزيل" />
          <p class="hint">
            الحجم نحو {bytes(info.gzBytes)}، ويُحفظ على جهازك لتقرأه لاحقًا دون اتصال.
          </p>
        </div>
      )}
    </div>
  );
}

function Reader({ book }: { book: Book }) {
  const { slug } = book.info;
  const { hadiths, sections } = book;
  const { query } = useRoute();

  // Browse window [start, end) and search state
  const start = useSignal(0);
  const end = useSignal(Math.min(PAGE, hadiths.length));
  const input = useSignal('');
  const q = useSignal('');
  const index = useSignal<string[] | null>(null);
  const indexProgress = useSignal(0);
  const shown = useSignal(PAGE);
  const flash = useSignal<number | null>(null);
  const visible = useSignal(0); // index of the card at the top of the screen
  const sheet = useSignal<'sections' | 'jump' | null>(null);
  const scrollTarget = useRef<number | null>(null);
  const handledN = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const multiSection = sections.length > 1;
  const first = hadiths[0]?.n ?? 1;
  const resumeN = lastRead.value[slug];
  const searching = q.value.length > 0;

  const ensureIndex = () => {
    if (index.value) return;
    void searchIndex(book, (p) => (indexProgress.value = p)).then((ix) => (index.value = ix));
  };

  const raw = input.value.trim();
  const numericQuery = /^[\d٠-٩۰-۹]+$/.test(raw) ? parseArNum(raw) : null;

  // Debounced search (a bare number is offered as a jump instead)
  useEffect(() => {
    const t = setTimeout(() => {
      q.value = numericQuery == null && normalizeArabic(raw).length >= 2 ? raw : '';
      shown.value = PAGE;
      if (q.value) ensureIndex();
    }, 250);
    return () => clearTimeout(t);
  }, [input.value]);

  const results = useMemo(
    () => (q.value && index.value ? search(index.value, q.value) : null),
    [q.value, index.value],
  );
  const terms = useMemo(() => (q.value ? queryTerms(q.value) : []), [q.value]);

  const jumpToIndex = (i: number) => {
    input.value = '';
    q.value = '';
    start.value = i;
    end.value = Math.min(hadiths.length, i + PAGE);
    flash.value = i;
    scrollTarget.current = i;
    setTimeout(() => flash.value === i && (flash.value = null), 2200);
  };

  const jumpToNumber = (n: number, alt = false) => {
    const i = alt ? indexOfAltNumber(hadiths, n) : indexOfNumber(hadiths, n);
    if (i < 0) {
      toast(`لا يوجد حديث برقم ${arNum(n)} في هذا الكتاب`);
      return false;
    }
    if (!alt && hadiths[i].n !== n) toast(`الحديث ${num(n)} غير متوفر في هذه النسخة، وهذا أقرب حديث بعده`);
    jumpToIndex(i);
    return true;
  };

  // Deep link: /hadith/bukhari?n=123
  useEffect(() => {
    const n = query.n;
    if (!n || n === handledN.current) return;
    handledN.current = n;
    const v = Number.parseFloat(n);
    if (Number.isFinite(v)) {
      const i = indexOfNumber(hadiths, v);
      if (i >= 0) jumpToIndex(i);
    }
  }, [query.n]);

  // Scroll a jump target into view once it is rendered
  useEffect(() => {
    const i = scrollTarget.current;
    if (i == null) return;
    const el = document.getElementById(`h-${i}`);
    if (el) {
      scrollTarget.current = null;
      // After the shell's own scroll-to-top on navigation.
      requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
    }
  });

  // Load more when the sentinel nears the viewport
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (searching) {
          if (results && shown.value < results.length) shown.value += PAGE;
        } else if (end.value < hadiths.length) {
          end.value = Math.min(hadiths.length, end.value + PAGE);
        }
      },
      { rootMargin: '0px 0px 900px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [searching, results, end.value, shown.value]);

  // Remember the reading position (card crossing the upper part of the screen)
  useEffect(() => {
    const root = listRef.current;
    if (!root || searching) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.i);
          if (!Number.isFinite(i)) continue;
          visible.value = i;
          clearTimeout(timer);
          timer = setTimeout(() => {
            const n = hadiths[i]?.n;
            if (n != null && lastRead.value[slug] !== n) lastRead.value = { ...lastRead.value, [slug]: n };
          }, 900);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    root.querySelectorAll<HTMLElement>('.hadith-card').forEach((c) => io.observe(c));
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [searching, start.value, end.value]);

  const currentSection = hadiths[visible.value]?.sec ?? 0;

  // ── Render ──
  const items: JSX.Element[] = [];
  if (searching && results) {
    const upto = Math.min(results.length, shown.value);
    for (let k = 0; k < upto; k++) {
      const i = results[k];
      const h = hadiths[i];
      items.push(
        <HadithCard
          key={i}
          hadith={h}
          index={i}
          info={book.info}
          terms={terms}
          section={multiSection ? sectionLabel(slug, sections[h.sec], h.sec) : undefined}
        />,
      );
    }
  } else if (!searching) {
    let prevSec = -1;
    for (let i = start.value; i < end.value; i++) {
      const h = hadiths[i];
      if (multiSection && h.sec !== prevSec) {
        const s = sections[h.sec];
        items.push(
          <h2 key={`s${h.sec}`} class="hadith-section-head">
            <span>{sectionLabel(slug, s, h.sec)}</span>
            <small>{rangeLabel(s)}</small>
          </h2>,
        );
      }
      prevSec = h.sec;
      items.push(<HadithCard key={i} hadith={h} index={i} info={book.info} flash={flash.value === i} />);
    }
  }

  const more = searching ? !!results && shown.value < results.length : end.value < hadiths.length;

  return (
    <>
      <div class="hadith-toolbar">
        <label class="search-field">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={input.value}
            onInput={(e) => (input.value = e.currentTarget.value)}
            onFocus={ensureIndex}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && numericQuery != null) jumpToNumber(numericQuery);
            }}
            placeholder="ابحث في الكتاب بكلمة أو أكثر"
            aria-label={`البحث في ${book.info.name}`}
            enterKeyHint="search"
          />
          {input.value && (
            <button class="icon-btn hd-clear-btn" onClick={() => (input.value = '')} aria-label="مسح البحث">
              <Icon name="x" size={16} />
            </button>
          )}
        </label>
        {multiSection && (
          <button class="btn btn-ghost hd-toolbar-btn" onClick={() => (sheet.value = 'sections')} aria-haspopup="dialog">
            <Icon name="list" size={18} />
            <span class="hd-toolbar-label">الكتب والأبواب</span>
          </button>
        )}
        <button class="btn btn-ghost hd-toolbar-btn" onClick={() => (sheet.value = 'jump')} aria-haspopup="dialog">
          <Icon name="target" size={18} />
          <span class="hd-toolbar-label">انتقال إلى رقم</span>
        </button>
      </div>

      {!searching && !query.n && resumeN && resumeN > first && start.value === 0 && visible.value < 2 && (
        <button class="chip hd-resume-chip" onClick={() => jumpToNumber(resumeN)}>
          <Icon name="bookmark" size={15} /> متابعة القراءة من الحديث {num(resumeN)}
        </button>
      )}

      {searching && (
        <div class="hd-search-status" role="status" aria-live="polite">
          {!results ? (
            <div class="hd-index-progress">
              <span>جارٍ تجهيز البحث… {arNum(Math.round(indexProgress.value * 100))}٪</span>
              <Progress value={indexProgress.value} max={1} label="تجهيز البحث" />
            </div>
          ) : results.length ? (
            <span>
              {results.length === 1 ? 'نتيجة واحدة' : `${arNum(results.length)} نتيجة`} لـ «{q.value}»
            </span>
          ) : null}
        </div>
      )}

      {numericQuery != null && (
        <div class="hd-search-status">
          <button class="chip" onClick={() => jumpToNumber(numericQuery)}>
            <Icon name="target" size={15} /> الانتقال إلى الحديث رقم {arNum(numericQuery)}
          </button>
        </div>
      )}

      {searching && results && !results.length && (
        <Empty icon="search" title="لا توجد نتائج">
          <p class="hint">جرّب كلمة أقصر أو كلمات أقل. البحث لا يتأثر بالتشكيل.</p>
        </Empty>
      )}

      {!searching && start.value > 0 && (
        <button
          class="btn btn-ghost btn-block hd-load-prev"
          onClick={() => (start.value = Math.max(0, start.value - PAGE))}
        >
          <Icon name="chevronDown" size={18} class="hd-up" /> عرض الأحاديث السابقة
        </button>
      )}

      <div class="hadith-list" ref={listRef}>
        {items}
      </div>
      <div ref={sentinel} class="hd-list-sentinel" aria-hidden="true" />
      {more && (
        <button
          class="btn btn-ghost btn-block hd-load-more"
          onClick={() =>
            searching ? (shown.value += PAGE) : (end.value = Math.min(hadiths.length, end.value + PAGE))
          }
        >
          عرض المزيد
        </button>
      )}
      {!more && !searching && end.value >= hadiths.length && (
        <p class="hint center hd-list-end">نهاية الكتاب</p>
      )}

      <Sheet open={sheet.value === 'sections'} onClose={() => (sheet.value = null)} title="الكتب والأبواب" class="hd-sections-sheet">
        <SectionsList
          book={book}
          current={currentSection}
          onPick={(i) => {
            sheet.value = null;
            jumpToIndex(sections[i].start);
          }}
        />
      </Sheet>

      <Sheet open={sheet.value === 'jump'} onClose={() => (sheet.value = null)} title="انتقال إلى حديث">
        <JumpForm
          info={book.info}
          first={first}
          last={hadiths[hadiths.length - 1]?.n ?? first}
          onJump={(n, alt) => {
            if (jumpToNumber(n, alt)) sheet.value = null;
          }}
        />
      </Sheet>
    </>
  );
}

function SectionsList({ book, current, onPick }: { book: Book; current: number; onPick: (i: number) => void }) {
  const filter = useSignal('');
  const { sections } = book;
  const slug = book.info.slug;
  const labels = useMemo(() => sections.map((s, i) => sectionLabel(slug, s, i)), [book]);
  const f = normalizeArabic(filter.value);
  const fNum = parseArNum(filter.value.trim());
  const list = sections
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !f || normalizeArabic(labels[i]).includes(f) || (Number.isFinite(fNum) && i + 1 === fNum));

  useEffect(() => {
    document.getElementById(`sec-${current}`)?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div class="hd-sections">
      {sections.length > 12 && (
        <div class="picker-tools">
          <label class="search-field">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={filter.value}
              onInput={(e) => (filter.value = e.currentTarget.value)}
              placeholder="تصفية بالاسم أو الرقم"
              aria-label="تصفية الكتب"
            />
          </label>
        </div>
      )}
      <ul class="hd-section-list">
        {list.map(({ s, i }) => (
          <li key={s.start}>
            <button
              id={`sec-${i}`}
              class={`hd-section-item${i === current ? ' is-current' : ''}`}
              onClick={() => onPick(i)}
              aria-current={i === current ? 'true' : undefined}
            >
              <span class="hd-section-num">{arNum(i + 1)}</span>
              <span class="hd-section-text">
                <span class="hd-section-name">{labels[i]}</span>
                <span class="hd-section-range">
                  {rangeLabel(s)} · {hadithCount(s.end - s.start)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li class="picker-empty">لا توجد نتائج</li>}
      </ul>
    </div>
  );
}

function JumpForm({
  info,
  first,
  last,
  onJump,
}: {
  info: BookInfo;
  first: number;
  last: number;
  onJump: (n: number, alt: boolean) => void;
}) {
  const value = useSignal('');
  const alt = useSignal(false);
  const submit = (e: Event) => {
    e.preventDefault();
    const n = parseArNum(value.value.trim());
    if (!Number.isFinite(n) || n < 0) {
      toast('اكتب رقم الحديث');
      return;
    }
    onJump(n, alt.value);
  };
  return (
    <form class="hd-jump-form" onSubmit={submit}>
      <label class="hd-jump-label" for="jump-n">
        رقم الحديث ({alt.value ? 'بترقيم عبد الباقي' : `من ${arNum(Math.floor(first))} إلى ${arNum(Math.floor(last))}`})
      </label>
      <div class="hd-jump-row">
        <input
          id="jump-n"
          class="input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value.value}
          onInput={(e) => (value.value = e.currentTarget.value)}
          autoFocus
        />
        <button class="btn" type="submit">
          انتقال
        </button>
      </div>
      {info.altNumbering && (
        <label class="setting-row hd-jump-alt">
          <span class="setting-text">
            <span class="setting-label">بترقيم محمد فؤاد عبد الباقي</span>
            <span class="setting-hint">الترقيم المعتمد في أغلب المراجع العربية لصحيح مسلم</span>
          </span>
          <input
            type="checkbox"
            class="switch"
            checked={alt.value}
            onChange={(e) => (alt.value = e.currentTarget.checked)}
          />
        </label>
      )}
    </form>
  );
}
