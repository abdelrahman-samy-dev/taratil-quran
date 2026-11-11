import { useComputed, useSignal, useSignalEffect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { currentAyah, isPlaying, playSurah, toggle, track } from '../../audio/player';
import meta from '../../data/quran-meta.json';
import { arNum } from '../../lib/arabic';
import { holdWakeLock } from '../../lib/device';
import { persisted } from '../../lib/storage';
import { chapterAtPage, mushafPage, parseKey, surahText, TOTAL_PAGES } from '../../quran/data';
import { prefs, setPref } from '../../state/prefs';
import { bookmarks, dayLog, lastRead, markPageRead, werdTarget, todayLog } from '../../state/progress';
import { Icon } from '../../ui/Icon';
import { Switch } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { AyahSheet } from './AyahSheet';
import { IndexSheet } from './IndexSheet';
import { PageView, prefetchPage } from './PageView';
import './mushaf.css';

const followAudio = persisted('mushaf:follow', true);
const READ_AFTER_MS = 20_000;

const clampPage = (p: number) => Math.min(TOTAL_PAGES, Math.max(1, Math.round(p) || 1));

function useWide() {
  const wide = useSignal(typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1100px)').matches);
  useEffect(() => {
    const mq = matchMedia('(min-width: 1100px)');
    const on = (e: MediaQueryListEvent) => (wide.value = e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function MushafPage() {
  const { params, query } = useRoute();
  const initial = params.page ? clampPage(Number(params.page)) : lastRead.value.page || 1;
  const page = useSignal(initial);
  const selected = useSignal<string | null>(query.k ?? null);
  const sheetKey = useSignal<string | null>(null);
  const indexOpen = useSignal(false);
  const settingsOpen = useSignal(false);
  const chrome = useSignal(true);
  const dir = useSignal<'next' | 'prev' | null>(null);
  const wide = useWide();
  const spread = useComputed(() => wide.value && prefs.value.mushafSpread);
  const stage = useRef<HTMLDivElement>(null);

  // Pages on screen: in a spread the odd page sits on the right, like a printed mushaf.
  const shown = useComputed(() => {
    const p = page.value;
    if (!spread.value) return [p];
    const right = p % 2 === 1 ? p : p - 1;
    return right + 1 <= TOTAL_PAGES ? [right, right + 1] : [right];
  });

  // Deep link: /mushaf/12 or ?k=2:255
  useEffect(() => {
    if (params.page) page.value = clampPage(Number(params.page));
    if (query.k) selected.value = query.k;
  }, [params.page, query.k]);

  // Keep the URL, last-read position and neighbours in sync with the page.
  useSignalEffect(() => {
    const p = page.value;
    const url = `/mushaf/${p}`;
    if (location.pathname !== url) history.replaceState(history.state, '', url + location.search.replace(/([?&])k=[^&]*/, '$1').replace(/\?$/, ''));
    const t = setTimeout(() => (lastRead.value = { page: p, at: Date.now() }), 1500);
    const step = spread.value ? 2 : 1;
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300))) as (cb: () => void) => number;
    idle(() => {
      prefetchPage(p + step);
      prefetchPage(p + step + 1);
      prefetchPage(p - step);
    });
    return () => clearTimeout(t);
  });

  // A page counts as read after staying on it for a while (only while the tab is visible).
  useSignalEffect(() => {
    const pages = shown.value;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (document.visibilityState !== 'visible') return;
      timer = setTimeout(() => {
        const before = dayLog().pages.length;
        pages.forEach(markPageRead);
        const after = dayLog().pages.length;
        const target = werdTarget.value;
        if (before < target && after >= target) toast('أتممت وردك اليوم، تقبّل الله منك');
      }, READ_AFTER_MS);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  });

  // Screen stays on while reading; immersive chrome on phones.
  useSignalEffect(() => {
    if (prefs.value.keepAwake) return holdWakeLock();
  });
  useEffect(() => () => document.documentElement.classList.remove('reading-focus'), []);
  useSignalEffect(() => {
    document.documentElement.classList.toggle('reading-focus', !chrome.value);
  });

  // Follow the recitation: highlight the ayah being recited and turn pages with it.
  const playingKey = useSignal<string | null>(null);
  const versePages = useSignal<{ surah: number; p: number[] } | null>(null);
  useSignalEffect(() => {
    const t = track.value;
    if (t?.kind !== 'surah') {
      playingKey.value = null;
      return;
    }
    if (versePages.value?.surah !== t.surah) {
      surahText(t.surah).then((d) => (versePages.value = { surah: t.surah, p: d.p }));
    }
  });
  useSignalEffect(() => {
    const t = track.value;
    const a = currentAyah.value;
    if (t?.kind !== 'surah' || !a) {
      playingKey.value = null;
      return;
    }
    playingKey.value = `${t.surah}:${a}`;
    const vp = versePages.value;
    if (followAudio.value && isPlaying.value && vp?.surah === t.surah) {
      const target = vp.p[a - 1];
      if (target && !shown.peek().includes(target)) {
        dir.value = target > page.peek() ? 'next' : 'prev';
        page.value = target;
      }
    }
  });

  const go = (p: number, key?: string) => {
    const target = clampPage(p);
    if (target === page.value && !key) return;
    dir.value = target > page.value ? 'next' : 'prev';
    page.value = target;
    selected.value = key ?? null;
  };
  const step = () => (spread.value ? 2 : 1);
  const next = () => {
    const last = shown.value[shown.value.length - 1];
    if (last < TOTAL_PAGES) go(last + 1);
  };
  const prev = () => {
    const first = shown.value[0];
    if (first > 1) go(first - step());
  };

  // Keyboard: in an RTL mushaf the next page is to the left.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.documentElement.classList.contains('modal-open')) return;
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Swipe: drag right → next page (RTL), drag left → previous.
  const drag = useRef<{ x: number; y: number; dx: number; active: boolean; moved: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, active: false, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) d.active = true;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) d.moved = true;
    if (d.active && stage.current) {
      d.dx = dx;
      const atEdge = (dx > 0 && shown.value[shown.value.length - 1] >= TOTAL_PAGES) || (dx < 0 && shown.value[0] <= 1);
      stage.current.style.transform = `translateX(${atEdge ? dx * 0.25 : dx}px)`;
    }
  };
  const lastSwipe = useRef(0);
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !stage.current) return;
    if (d.moved) lastSwipe.current = Date.now();
    stage.current.style.transform = '';
    if (d.active && Math.abs(d.dx) > 70) {
      if (d.dx > 0) next();
      else prev();
    }
  };
  const swallowClick = (e: MouseEvent) => {
    // A swipe must not count as a tap on an ayah.
    if (drag.current?.moved || Date.now() - lastSwipe.current < 400) e.stopPropagation();
  };

  const onAyah = (key: string, p: number) => {
    selected.value = key;
    sheetKey.value = key;
    if (p !== page.value && !shown.value.includes(p)) page.value = p;
  };

  const first = shown.value[0];
  const c = chapterAtPage(first);
  const juz = meta.juz.filter((j) => j.page <= first).pop()?.juz ?? 1;
  const quarter = meta.quarters.filter((q) => q.page <= first).pop();
  const hizbLabel = quarter
    ? `الحزب ${arNum(quarter.hizb)}${quarter.rub % 4 === 2 ? ' · ربع' : quarter.rub % 4 === 3 ? ' · نصف' : quarter.rub % 4 === 0 ? ' · ثلاثة أرباع' : ''}`
    : '';
  const pageMarked = bookmarks.value.some((b) => !b.key && shown.value.includes(b.page));
  const readToday = todayLog.value.pages.length;
  const target = werdTarget.value;

  const togglePageMark = () => {
    if (pageMarked) {
      bookmarks.value = bookmarks.value.filter((b) => b.key || !shown.value.includes(b.page));
      toast('أُزيلت علامة الصفحة');
    } else {
      bookmarks.value = [{ id: `p${Date.now()}`, page: first, label: 'عام', at: Date.now() }, ...bookmarks.value];
      toast('حُفظت علامة على الصفحة');
    }
  };

  const listenFromPage = () => {
    const t = track.value;
    if (t?.kind === 'surah' && versePages.value?.surah === t.surah && versePages.value.p.includes(first)) {
      toggle();
      return;
    }
    // Start from the first ayah on this page.
    void mushafPage(first).then((d) => {
      const [s, a] = parseKey(d.k[0]);
      void playSurah(s, { ayah: a });
    });
  };

  return (
    <div class={`mushaf tone-${prefs.value.mushafTone}${chrome.value ? '' : ' chrome-off'}`}>
      <header class="mushaf-bar">
        <button class="mushaf-title" onClick={() => (indexOpen.value = true)} title="فهرس المصحف" aria-haspopup="dialog">
          <span class="mushaf-surah display">سورة {c.ar}</span>
          <span class="mushaf-meta">
            الجزء {arNum(juz)} · {hizbLabel}
          </span>
          <Icon name="chevronDown" size={18} />
        </button>
        <div class="mushaf-tools">
          <button
            class={`icon-btn${isPlaying.value ? ' on' : ''}`}
            onClick={listenFromPage}
            aria-label={isPlaying.value ? 'إيقاف التلاوة' : 'استمع لهذه الصفحة'}
            title="استمع"
          >
            <Icon name={isPlaying.value ? 'pause' : 'headphones'} size={20} />
          </button>
          <button
            class={`icon-btn${pageMarked ? ' on' : ''}`}
            onClick={togglePageMark}
            aria-label={pageMarked ? 'إزالة علامة الصفحة' : 'علامة على الصفحة'}
            aria-pressed={pageMarked}
          >
            <Icon name={pageMarked ? 'bookmarkFill' : 'bookmark'} size={20} />
          </button>
          <button class="icon-btn" onClick={() => (settingsOpen.value = true)} aria-label="إعدادات القراءة">
            <Icon name="sliders" size={20} />
          </button>
        </div>
      </header>

      <div class="mushaf-stage-wrap">
        <button class="mushaf-nav mushaf-nav-prev" onClick={prev} disabled={first <= 1} aria-label="الصفحة السابقة">
          <Icon name="chevronRight" size={26} />
        </button>
        <div
          class={`mushaf-stage${spread.value ? ' spread' : ''}${dir.value ? ` turn-${dir.value}` : ''}`}
          ref={stage}
          key={shown.value.join('-')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={swallowClick}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('[data-v]')) chrome.value = !chrome.value;
          }}
          style={{ '--dim': String(prefs.value.mushafDim) }}
        >
          {shown.value.map((p, i) => (
            <PageView
              key={p}
              page={p}
              side={shown.value.length === 2 ? (i === 0 ? 'right' : 'left') : 'single'}
              selected={selected.value}
              playing={playingKey.value}
              onAyah={onAyah}
            />
          ))}
        </div>
        <button
          class="mushaf-nav mushaf-nav-next"
          onClick={next}
          disabled={shown.value[shown.value.length - 1] >= TOTAL_PAGES}
          aria-label="الصفحة التالية"
        >
          <Icon name="chevronLeft" size={26} />
        </button>
      </div>

      <footer class="mushaf-foot">
        <div class="mushaf-werd" title="ورد اليوم">
          <Icon name="target" size={16} />
          <span>
            ورد اليوم {arNum(Math.min(readToday, target))}/{arNum(target)}
          </span>
          <div class="mushaf-werd-bar">
            <div style={{ width: `${Math.min(100, (readToday / target) * 100)}%` }} />
          </div>
        </div>
        <input
          type="range"
          class="mushaf-scrub"
          min={1}
          max={TOTAL_PAGES}
          value={first}
          aria-label="التنقل بين الصفحات"
          style={{ '--pct': `${((first - 1) / (TOTAL_PAGES - 1)) * 100}%` }}
          onChange={(e) => go(Number(e.currentTarget.value))}
        />
        <span class="mushaf-pageno">
          صفحة {arNum(first)}
          {shown.value.length === 2 ? `–${arNum(shown.value[1])}` : ''}
        </span>
      </footer>

      <AyahSheet ayahKey={sheetKey.value} page={page.value} onClose={() => (sheetKey.value = null)} />
      <IndexSheet open={indexOpen.value} onClose={() => (indexOpen.value = false)} onGo={go} page={first} />

      <Sheet open={settingsOpen.value} onClose={() => (settingsOpen.value = false)} title="إعدادات القراءة">
        <div class="setting-block">
          <span class="setting-label">لون الصفحة</span>
          <div class="tone-picker" role="radiogroup" aria-label="لون الصفحة">
            {(
              [
                ['paper', 'ورقي'],
                ['white', 'أبيض'],
                ['sepia', 'بُنّي'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                role="radio"
                aria-checked={prefs.value.mushafTone === v}
                class={`tone-swatch tone-${v}${prefs.value.mushafTone === v ? ' active' : ''}`}
                onClick={() => setPref('mushafTone', v)}
              >
                <span />
                {l}
              </button>
            ))}
          </div>
        </div>
        <div class="setting-block">
          <span class="setting-label">تعتيم الصفحة للقراءة الليلية</span>
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.05}
            value={prefs.value.mushafDim}
            style={{ '--pct': `${(prefs.value.mushafDim / 0.6) * 100}%` }}
            onInput={(e) => setPref('mushafDim', Number(e.currentTarget.value))}
            aria-label="درجة التعتيم"
          />
        </div>
        <Switch
          label="متابعة التلاوة"
          hint="تظليل الآية المتلوّة وتقليب الصفحات معها"
          checked={followAudio.value}
          onChange={(v) => (followAudio.value = v)}
        />
        <Switch
          label="صفحتان متجاورتان"
          hint="على الشاشات العريضة، كالمصحف المطبوع"
          checked={prefs.value.mushafSpread}
          onChange={(v) => setPref('mushafSpread', v)}
        />
        <Switch
          label="إبقاء الشاشة مضاءة"
          checked={prefs.value.keepAwake}
          onChange={(v) => setPref('keepAwake', v)}
        />
      </Sheet>
    </div>
  );
}
