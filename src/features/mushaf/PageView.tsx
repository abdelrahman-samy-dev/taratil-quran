import { useSignal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { chapter, mushafPage, type MushafPageData } from '../../quran/data';
import { fontFamily, isFontReady, loadPageFont } from './fonts';

interface Props {
  page: number;
  /** Verse keys to highlight as selected (tapped) / being recited. */
  selected?: string | null;
  playing?: string | null;
  onAyah?: (key: string, page: number) => void;
  side?: 'right' | 'left' | 'single';
}

// Natural line width ÷ font-size for a full line, used to size pages 1–2 which have short lines.
const FULL_LINE_RATIO = 15.6;

/** One mushaf page rendered with its own QCF v2 font, fitted to the available width. */
export function PageView({ page, selected, playing, onAyah, side = 'single' }: Props) {
  const data = useSignal<MushafPageData | null>(null);
  const fontReady = useSignal(isFontReady(page));
  const failed = useSignal(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    failed.value = false;
    data.value = null;
    fontReady.value = isFontReady(page);
    mushafPage(page)
      .then((d) => alive && (data.value = d))
      .catch(() => alive && (failed.value = true));
    loadPageFont(page)
      .then(() => alive && (fontReady.value = true))
      .catch(() => alive && (failed.value = true));
    return () => {
      alive = false;
    };
  }, [page]);

  const ready = !!data.value && fontReady.value;

  // Fit: measure natural line widths at 100px, then scale so the widest line fills the page.
  useLayoutEffect(() => {
    const el = box.current;
    if (!ready || !el) return;
    const fit = () => {
      const lines = [...el.querySelectorAll<HTMLElement>('.ln-a')];
      if (!lines.length) return;
      el.style.setProperty('--fs', '100px');
      el.classList.add('measuring');
      const widths = lines.map((l) => {
        let w = 0;
        for (const c of l.children) w += (c as HTMLElement).getBoundingClientRect().width;
        return w;
      });
      el.classList.remove('measuring');
      const avail = el.clientWidth - parseFloat(getComputedStyle(el).paddingInlineStart) * 2;
      const max = Math.max(...widths);
      const ratio = page <= 2 ? FULL_LINE_RATIO : max / 100;
      const fs = Math.max(10, Math.min(64, (avail / ratio) * 0.985));
      el.style.setProperty('--fs', `${fs}px`);
      lines.forEach((l, i) => l.classList.toggle('j', page > 2 && widths[i] / max > 0.8));
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, page]);

  const d = data.value;
  const family = fontFamily(page);

  const onClick = (e: MouseEvent) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
    if (!w || !d || !onAyah) return;
    onAyah(d.k[Number(w.dataset.v)], page);
  };

  return (
    <article
      class={`mp-page mp-${side}${ready ? ' ready' : ''}${page <= 2 ? ' opening' : ''}`}
      aria-label={`صفحة ${arNum(page)}`}
      data-page={page}
    >
      <header class="mp-page-head" aria-hidden="true">
        {d && (
          <>
            <span>سورة {chapter(Number(d.k[0].split(':')[0])).ar}</span>
            <span>الجزء {arNum(d.juz)}</span>
          </>
        )}
      </header>
      <div class="mp-lines" ref={box} onClick={onClick} style={{ fontFamily: `${family}, var(--font-quran)` }}>
        {failed.value ? (
          <div class="mp-failed">
            <p>تعذر تحميل الصفحة. تحقق من الاتصال بالإنترنت.</p>
          </div>
        ) : !ready || !d ? (
          <div class="mp-skeleton" aria-busy="true" aria-label="جارٍ تحميل الصفحة">
            {Array.from({ length: page <= 2 ? 8 : 15 }, (_, i) => (
              <div key={i} class="skeleton-line" />
            ))}
          </div>
        ) : (
          d.l.map((line) => {
            if (line.t !== 'a' && line.t === 's') {
              return (
                <div key={line.n} class="ln ln-s" role="heading" aria-level={2}>
                  <span class="surah-frame">سورة {chapter(line.s).ar}</span>
                </div>
              );
            }
            if (line.t !== 'a') {
              return (
                <div key={line.n} class="ln ln-b">
                  بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                </div>
              );
            }
            return (
              <div key={line.n} class="ln ln-a">
                {line.w.map(([glyph, vi, end], i) => {
                  const key = d.k[vi];
                  const cls = `w${end ? ' end' : ''}${key === selected ? ' sel' : ''}${key === playing ? ' play' : ''}`;
                  return (
                    <span key={i} class={cls} data-v={vi}>
                      {glyph}
                    </span>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
      <footer class="mp-page-foot">
        <span class="mp-page-num">{arNum(page)}</span>
      </footer>
    </article>
  );
}

/** Warm the cache for a page we are likely to open next. */
export function prefetchPage(p: number): void {
  if (p < 1 || p > 604) return;
  void mushafPage(p).catch(() => {});
  void loadPageFont(p).catch(() => {});
}
