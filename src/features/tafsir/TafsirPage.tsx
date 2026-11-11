import { useSignal } from '@preact/signals';
import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { currentAyah, track } from '../../audio/player';
import { arNum, parseArNum, plural } from '../../lib/arabic';
import { persisted, read, write } from '../../lib/storage';
import { BASMALA, chapter, placeLabel, surahText, type Chapter, type SurahText } from '../../quran/data';
import { prefs, setPref } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { ErrorState, Progress, Segmented, Skeleton } from '../../ui/kit';
import { SurahPicker } from '../../ui/SurahPicker';
import { HifzCard, ReadCard } from './AyahCards';
import { EditionSheet } from './EditionSheet';
import { loadTafsir, resolveEdition, type Edition } from './editions';
import { SCALE_MAX, SCALE_MIN, SCALE_STEP, clampScale, nextHidden } from './text';
import './tafsir.css';

type Mode = 'read' | 'hifz';

const mode = persisted<Mode>('tafsir:mode', 'read');
const hintFirstWord = persisted<boolean>('tafsir:hint', true);

function lastSurah(): number {
  const n = Math.floor(Number(read<number>('tafsir:last', 1)));
  return n >= 1 && n <= 114 ? n : 1;
}

function pagesLabel(c: Chapter): string {
  const [a, b] = c.pages;
  return a === b ? `صفحة ${arNum(a)}` : `الصفحات ${arNum(a)}–${arNum(b)}`;
}

export default function TafsirPage() {
  const { params, query } = useRoute();
  const { route } = useLocation();
  const fromParam = Number.parseInt(params.surah ?? '', 10);
  const surah = useMemo(() => (fromParam >= 1 && fromParam <= 114 ? fromParam : lastSurah()), [fromParam]);
  const c = chapter(surah);
  const asked = parseArNum(query.a ?? '');
  const target = asked >= 1 && asked <= c.verses ? asked : 0;
  const edition = resolveEdition(prefs.value.tafsir);
  const hifz = mode.value === 'hifz';

  const pickerOpen = useSignal(false);
  const editionOpen = useSignal(false);

  useEffect(() => write('tafsir:last', surah), [surah]);

  // Quran text: always from the shipped data files.
  const text = useSignal<SurahText | null>(null);
  const textFailed = useSignal(false);
  const textTry = useSignal(0);
  useEffect(() => {
    let live = true;
    if (text.value?.id !== surah) text.value = null;
    textFailed.value = false;
    surahText(surah)
      .then((d) => live && (text.value = d))
      .catch(() => live && (textFailed.value = true));
    return () => {
      live = false;
    };
  }, [surah, textTry.value]);

  // Tafsir: one request per surah and edition.
  const tafsir = useSignal<{ key: string; list: string[] } | null>(null);
  const tafsirFailed = useSignal(false);
  const tafsirSlow = useSignal(false);
  const tafsirTry = useSignal(0);
  const tKey = `${edition.id}/${surah}`;
  useEffect(() => {
    if (hifz || tafsir.value?.key === tKey) return;
    let live = true;
    tafsirFailed.value = false;
    tafsirSlow.value = false;
    const slow = setTimeout(() => live && (tafsirSlow.value = true), 3500);
    loadTafsir(surah, edition.id)
      .then((list) => live && (tafsir.value = { key: tKey, list }))
      .catch(() => live && (tafsirFailed.value = true))
      .finally(() => clearTimeout(slow));
    return () => {
      live = false;
      clearTimeout(slow);
    };
  }, [tKey, hifz, tafsirTry.value]);
  const tafsirList = tafsir.value?.key === tKey ? tafsir.value.list : null;

  const prev = surah > 1 ? chapter(surah - 1) : null;
  const next = surah < 114 ? chapter(surah + 1) : null;

  return (
    <div class="tf-page">
      <h1 class="sr-only">تفسير سورة {c.ar}</h1>
      <section class="tf-hero" aria-label="السورة">
        {prev ? (
          <a class="tf-nav" href={`/tafsir/${prev.id}`} aria-label={`السورة السابقة: ${prev.ar}`}>
            <Icon name="chevronRight" size={22} />
            <span class="tf-nav-name">{prev.ar}</span>
          </a>
        ) : (
          <span class="tf-nav" aria-hidden="true" />
        )}
        <button
          class="tf-title-btn"
          onClick={() => (pickerOpen.value = true)}
          aria-haspopup="dialog"
          aria-label={`سورة ${c.ar}. اختر سورة أخرى`}
        >
          <span class="tf-kicker">سورة رقم {arNum(c.id)}</span>
          <span class="tf-title">
            <span class="display">سورة {c.ar}</span>
            <Icon name="chevronDown" size={20} />
          </span>
          <span class="tf-meta">
            {placeLabel(c)} · {plural(c.verses, 'آية واحدة', 'آيتان', 'آيات', 'آية')} · {pagesLabel(c)}
          </span>
        </button>
        {next ? (
          <a class="tf-nav" href={`/tafsir/${next.id}`} aria-label={`السورة التالية: ${next.ar}`}>
            <Icon name="chevronLeft" size={22} />
            <span class="tf-nav-name">{next.ar}</span>
          </a>
        ) : (
          <span class="tf-nav" aria-hidden="true" />
        )}
      </section>

      <SurahView
        key={`${surah}:${target}`}
        surah={surah}
        target={target}
        hifz={hifz}
        edition={edition}
        text={text.value?.id === surah ? text.value : null}
        textFailed={textFailed.value}
        onRetryText={() => textTry.value++}
        tafsir={tafsirList}
        tafsirFailed={tafsirFailed.value}
        tafsirSlow={tafsirSlow.value}
        onRetryTafsir={() => tafsirTry.value++}
        onEditions={() => (editionOpen.value = true)}
        next={next}
      />

      <SurahPicker
        open={pickerOpen.value}
        onClose={() => (pickerOpen.value = false)}
        current={surah}
        onPick={(ch) => {
          pickerOpen.value = false;
          route(`/tafsir/${ch.id}`);
        }}
      />
      <EditionSheet
        open={editionOpen.value}
        current={edition.id}
        onClose={() => (editionOpen.value = false)}
        onPick={(id) => {
          setPref('tafsir', id);
          editionOpen.value = false;
        }}
      />
    </div>
  );
}

interface ViewProps {
  surah: number;
  target: number;
  hifz: boolean;
  edition: Edition;
  text: SurahText | null;
  textFailed: boolean;
  onRetryText: () => void;
  tafsir: string[] | null;
  tafsirFailed: boolean;
  tafsirSlow: boolean;
  onRetryTafsir: () => void;
  onEditions: () => void;
  next: Chapter | null;
}

/**
 * Toolbar + ayat of one surah. Keyed by surah and target ayah, so a new surah
 * starts with a fresh window, hifz progress and expanded set.
 */
function SurahView(props: ViewProps) {
  const { surah, target, hifz, edition, text, tafsir, next } = props;
  const c = chapter(surah);
  const total = c.verses;
  const batch = hifz ? 40 : edition.long ? 8 : 20;
  const first = target || 1;

  // Rendered window [start, end]: grows as the reader scrolls.
  const start = useSignal(first);
  const end = useSignal(Math.min(total, first + batch - 1));
  const expanded = useSignal<ReadonlySet<number>>(new Set());
  const revealed = useSignal<ReadonlySet<number>>(new Set());
  const lastRevealed = useRef(first - 1);
  const flash = useSignal(target);
  const pending = useRef<{ n: number; block: ScrollLogicalPosition; smooth: boolean } | null>(
    target ? { n: target, block: 'start', smooth: false } : null,
  );
  const sentinel = useRef<HTMLDivElement>(null);
  const scale = prefs.value.quranScale;

  // Grow the window when the sentinel nears the viewport. Re-created after each
  // growth so it fires again if the sentinel is still visible.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !text || end.value >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) end.value = Math.min(total, end.value + batch);
      },
      { rootMargin: '0px 0px 1400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [end.value, !!text, total, batch]);

  // Scroll to a requested ayah once it is rendered.
  useEffect(() => {
    const p = pending.current;
    if (!p || !text) return;
    const el = document.getElementById(`ayah-${p.n}`);
    if (!el) return;
    pending.current = null;
    const go = (smooth: boolean) => scrollToAyah(el, p.block === 'center', smooth);
    requestAnimationFrame(() => go(p.smooth));
    if (p.smooth) return;
    // Web fonts arriving later change heights above the ayah: settle again,
    // unless the reader has already started scrolling.
    let moved = false;
    const stop = () => (moved = true);
    const opts = { passive: true, once: true } as const;
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) addEventListener(ev, stop, opts);
    void document.fonts?.ready.then(() => setTimeout(() => !moved && go(false), 60));
    setTimeout(() => {
      if (!moved) go(false);
      for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) removeEventListener(ev, stop);
    }, 700);
  });

  useEffect(() => {
    if (!flash.value || !text) return;
    const t = setTimeout(() => (flash.value = 0), 2600);
    return () => clearTimeout(t);
  }, [flash.value, !!text]);

  const onExpand = useCallback((n: number) => {
    const s = new Set(expanded.value);
    if (s.has(n)) s.delete(n);
    else s.add(n);
    expanded.value = s;
  }, []);

  const onToggle = useCallback((n: number) => {
    const s = new Set(revealed.value);
    if (s.has(n)) s.delete(n);
    else {
      s.add(n);
      lastRevealed.current = n;
    }
    revealed.value = s;
  }, []);

  const showAt = (n: number, block: ScrollLogicalPosition) => {
    if (n < start.value) start.value = n;
    if (n > end.value) end.value = Math.min(total, n + 5);
    pending.current = { n, block, smooth: true };
  };

  const revealNext = () => {
    const n = nextHidden(total, revealed.value, lastRevealed.current);
    if (!n) return;
    revealed.value = new Set(revealed.value).add(n);
    lastRevealed.current = n;
    showAt(n, 'center');
  };

  const hideAll = () => {
    revealed.value = new Set();
    lastRevealed.current = start.value - 1;
    showAt(start.value, 'start');
  };

  const playing = track.value?.kind === 'surah' && track.value.surah === surah ? currentAyah.value : 0;
  const revealedCount = revealed.value.size;
  const done = revealedCount >= total;

  const items: number[] = [];
  if (text) for (let n = start.value; n <= Math.min(end.value, total); n++) items.push(n);

  return (
    <>
      <div class="tf-bar">
        <div class="tf-bar-row">
          <Segmented<'read' | 'hifz'>
            label="طريقة العرض"
            value={hifz ? 'hifz' : 'read'}
            onChange={(v) => (mode.value = v)}
            options={[
              { value: 'read', label: 'تفسير' },
              { value: 'hifz', label: 'تسميع' },
            ]}
          />
          {!hifz && (
            <button
              class="chip tf-edition"
              onClick={props.onEditions}
              aria-haspopup="dialog"
              aria-label={`كتاب التفسير: ${edition.name}. تغيير`}
            >
              <Icon name="scroll" size={16} class="tf-edition-icon" />
              <span class="tf-edition-label">{edition.short}</span>
              <Icon name="chevronDown" size={16} />
            </button>
          )}
          <div class="tf-size" role="group" aria-label="حجم خط الآيات">
            <button
              class="tf-size-btn"
              onClick={() => setPref('quranScale', clampScale(scale - SCALE_STEP))}
              disabled={scale <= SCALE_MIN}
              aria-label="تصغير خط الآيات"
              title="تصغير الخط"
            >
              <span class="tf-size-a sm">أ</span>
              <Icon name="minus" size={12} />
            </button>
            <button
              class="tf-size-btn"
              onClick={() => setPref('quranScale', clampScale(scale + SCALE_STEP))}
              disabled={scale >= SCALE_MAX}
              aria-label="تكبير خط الآيات"
              title="تكبير الخط"
            >
              <span class="tf-size-a">أ</span>
              <Icon name="plus" size={12} />
            </button>
          </div>
        </div>

        {hifz && (
          <div class="tf-hifz-row">
            <span class="tf-count" aria-live="polite">
              <strong>{arNum(revealedCount)}</strong>
              <span class="muted"> / {arNum(total)}</span>
              <span class="sr-only"> آية مكشوفة</span>
            </span>
            <Progress value={revealedCount} max={total} label="الآيات المكشوفة" />
            <button
              class={`chip tf-hint${hintFirstWord.value ? ' active' : ''}`}
              onClick={() => (hintFirstWord.value = !hintFirstWord.value)}
              aria-pressed={hintFirstWord.value}
              title="إظهار الكلمة الأولى من كل آية"
            >
              الكلمة الأولى
            </button>
            <button class="icon-btn tf-reset" onClick={hideAll} aria-label="إخفاء كل الآيات" title="ابدأ من جديد">
              <Icon name="refresh" size={18} />
            </button>
            <button class="btn tf-next" onClick={revealNext} disabled={done}>
              <Icon name="eye" size={18} />
              <span>أظهر التالية</span>
            </button>
          </div>
        )}
      </div>

      {!hifz && props.tafsirFailed && (
        <div class="tf-banner error" role="alert">
          <Icon name="wifiOff" size={20} />
          <span>تعذّر تحميل {edition.name}. الآيات معروضة، والتفسير يحتاج اتصالًا بالإنترنت أول مرة.</span>
          <button class="btn btn-sm" onClick={props.onRetryTafsir}>
            إعادة المحاولة
          </button>
        </div>
      )}
      {!hifz && !tafsir && !props.tafsirFailed && props.tafsirSlow && (
        <div class="tf-banner" role="status">
          <span class="tf-spinner" aria-hidden="true" />
          <span>
            جارٍ تحميل {edition.name}…{edition.long ? ' هذا تفسير مطوّل وقد يستغرق تحميله وقتًا.' : ''}
          </span>
        </div>
      )}

      {props.textFailed ? (
        <ErrorState text="تعذّر تحميل آيات السورة. تحقّق من الاتصال ثم أعد المحاولة." onRetry={props.onRetryText} />
      ) : !text ? (
        <div class="tf-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} class="tf-ayah tf-ghost">
              <Skeleton lines={hifz ? 2 : 4} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {hifz && revealedCount === 0 && (
            <p class="hint tf-hifz-help">
              اقرأ من حفظك، ثم اضغط على الآية لتتحقّق منها، أو استعمل «أظهر التالية».
            </p>
          )}
          {start.value > 1 && (
            <button
              class="btn btn-ghost btn-block tf-earlier"
              onClick={() => (start.value = Math.max(1, start.value - batch))}
            >
              <Icon name="chevronDown" size={18} class="flip" />
              عرض الآيات السابقة ({arNum(Math.max(1, start.value - batch))}–{arNum(start.value - 1)})
            </button>
          )}
          {c.bismillah && start.value === 1 && (
            <p class="tf-basmala quran-text" aria-label="بسم الله الرحمن الرحيم">
              {BASMALA}
            </p>
          )}

          <div class={`tf-list${hifz ? ' hifz' : ''}`}>
            {items.map((n) =>
              hifz ? (
                <HifzCard
                  key={n}
                  n={n}
                  verse={text.v[n - 1]}
                  revealed={revealed.value.has(n)}
                  hint={hintFirstWord.value}
                  onToggle={onToggle}
                  playing={playing === n}
                  flash={flash.value === n}
                />
              ) : (
                <ReadCard
                  key={n}
                  surah={surah}
                  n={n}
                  verse={text.v[n - 1]}
                  page={text.p[n - 1]}
                  juz={text.j[n - 1]}
                  tafsir={tafsir ? (tafsir[n - 1] ?? '') : props.tafsirFailed ? null : undefined}
                  expanded={expanded.value.has(n)}
                  onExpand={onExpand}
                  playing={playing === n}
                  flash={flash.value === n}
                />
              ),
            )}
          </div>

          {end.value < total ? (
            <div ref={sentinel} class="tf-sentinel">
              <button class="btn btn-ghost" onClick={() => (end.value = Math.min(total, end.value + batch))}>
                عرض المزيد من الآيات
              </button>
            </div>
          ) : (
            <footer class="tf-end">
              {hifz && done && <p class="tf-done">أحسنت! كشفت آيات السورة كلها.</p>}
              {hifz && revealedCount > 0 && (
                <button class="btn btn-outline" onClick={hideAll}>
                  <Icon name="refresh" size={18} /> ابدأ التسميع من جديد
                </button>
              )}
              {next && (
                <a class="tf-next-surah" href={`/tafsir/${next.id}`}>
                  <span class="tf-next-kicker">السورة التالية</span>
                  <span class="tf-next-name display">سورة {next.ar}</span>
                  <Icon name="chevronLeft" size={22} />
                </a>
              )}
            </footer>
          )}
        </>
      )}
    </>
  );
}

function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Scrolls an ayah just below the sticky toolbar (or to the middle of the free
 * area). Measured from the toolbar's stuck position, so it does not depend on
 * the page's scroll-padding or on the toolbar's current height.
 */
function scrollToAyah(el: HTMLElement, center: boolean, smooth: boolean): void {
  const bar = document.querySelector<HTMLElement>('.tf-bar');
  const stuckBottom = bar ? (Number.parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight : 0;
  const r = el.getBoundingClientRect();
  const free = window.innerHeight - stuckBottom;
  const gap = center && r.height < free ? (free - r.height) / 2 : 10;
  window.scrollTo({
    top: Math.max(0, window.scrollY + r.top - stuckBottom - gap),
    behavior: smooth && !reducedMotion() ? 'smooth' : 'auto',
  });
}
