import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import {
  RATES,
  playSurah,
  ayahLoop,
  changeRecitation,
  currentAyah,
  cycleRepeat,
  duration,
  errorText,
  fullPlayerOpen,
  loopAyah,
  next,
  prev,
  rate,
  repeat,
  seek,
  seekToAyah,
  setRate,
  setSleep,
  skip,
  sleepAt,
  sleepEndOfSurah,
  status,
  time,
  timings,
  toggle,
  track,
} from '../audio/player';
import { ReciterPicker } from '../audio/ReciterPicker';
import { styleLabel } from '../audio/reciters';
import { downloadState, downloadSurah, removeDownload } from '../audio/offline';
import { arNum } from '../lib/arabic';
import { clock } from '../lib/format';
import { chapter, parseKey, placeLabel, surahText, type SurahText } from '../quran/data';
import { prefs } from '../state/prefs';
import type { PageView } from '../features/mushaf/PageView';

type PageViewType = typeof PageView;
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

export function FullPlayer() {
  const t = track.value;
  const open = fullPlayerOpen.value && t?.kind === 'surah';
  const text = useSignal<SurahText | null>(null);
  const pickReciter = useSignal(false);
  const sleepMenu = useSignal(false);
  const loopMenu = useSignal<number | null>(null);
  const viewPage = useSignal(0);
  const PageViewC = useSignal<null | PageViewType>(null);
  const userMovedAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const surah = t?.kind === 'surah' ? t.surah : 0;

  // The mushaf page component (and its fonts/styles) loads only when the player opens.
  useEffect(() => {
    if (open && !PageViewC.value) void import('../features/mushaf/PageView').then((m) => (PageViewC.value = m.PageView));
  }, [open]);

  useEffect(() => {
    if (!open || !surah) return;
    let alive = true;
    text.value = null;
    viewPage.value = chapter(surah).pages[0];
    surahText(surah)
      .then((d) => alive && (text.value = d))
      .catch(() => alive && (text.value = null));
    return () => {
      alive = false;
    };
  }, [open, surah]);

  // Follow the recitation: show the page of the ayah being recited, unless the user is browsing.
  const ayah = currentAyah.value;
  useEffect(() => {
    const d = text.value;
    if (!open || !d || d.id !== surah || !ayah || Date.now() - userMovedAt.current < 8000) return;
    const p = d.p[ayah - 1];
    if (p && p !== viewPage.value) viewPage.value = p;
  }, [ayah, open, text.value]);

  // Keep the highlighted line in view.
  useEffect(() => {
    if (!open || Date.now() - userMovedAt.current < 8000) return;
    const id = requestAnimationFrame(() => {
      const el = scroller.current?.querySelector<HTMLElement>('.w.play');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [ayah, open, viewPage.value, PageViewC.value]);

  if (!t || t.kind !== 'surah') return null;
  const c = chapter(t.surah);
  const exact = timings.value?.exact;
  const dl = downloadState.value[t.url];

  return (
    <>
      <Sheet open={open} onClose={() => (fullPlayerOpen.value = false)} variant="full" class="full-player" title="">
        <div class="fp">
          <header class="fp-head">
            <button class="icon-btn" onClick={() => (fullPlayerOpen.value = false)} aria-label="تصغير المشغل">
              <Icon name="chevronDown" size={24} />
            </button>
            <div class="fp-title">
              <h2>سورة {c.ar}</h2>
              <p>
                {placeLabel(c)} · {arNum(c.verses)} آية
                {timings.value && (
                  <span class={`tag ${exact ? 'tag-accent' : ''}`} title={exact ? 'مواضع الآيات من التسجيل نفسه' : 'تقدير حسب طول الآيات — اضغط على أي آية للانتقال إليها'}>
                    <Icon name={exact ? 'zap' : 'waveform'} size={11} /> {exact ? 'تظليل دقيق' : 'تظليل تقريبي'}
                  </span>
                )}
              </p>
            </div>
            <button
              class="icon-btn"
              onClick={() => (dl === 'done' ? removeDownload(t.url) : downloadSurah(t.url, `سورة ${c.ar} - ${t.recitation.name}`))}
              aria-label={dl === 'done' ? 'حذف التحميل' : 'تحميل للاستماع بدون إنترنت'}
              title={dl === 'done' ? 'محمّلة — اضغط للحذف' : 'تحميل للاستماع بدون إنترنت'}
              disabled={typeof dl === 'number'}
            >
              {typeof dl === 'number' ? (
                <span class="dl-pct">{arNum(Math.round(dl * 100))}٪</span>
              ) : (
                <Icon name={dl === 'done' ? 'checkCircle' : 'download'} size={22} />
              )}
            </button>
          </header>

          <div
            class={`fp-page mp-tone tone-${prefs.value.mushafTone}`}
            ref={scroller}
            onWheel={() => (userMovedAt.current = Date.now())}
            onTouchMove={() => (userMovedAt.current = Date.now())}
          >
            {PageViewC.value && viewPage.value ? (
              <PageViewC.value
                key={viewPage.value}
                page={viewPage.value}
                playing={ayah ? `${t.surah}:${ayah}` : null}
                selected={ayahLoop.value ? `${t.surah}:${ayahLoop.value.ayah}` : null}
                onAyah={(key) => {
                  const [s, a] = parseKey(key);
                  userMovedAt.current = 0;
                  if (s === t.surah) seekToAyah(a);
                  else void playSurah(s, { ayah: a, recitationId: t.recitation.id });
                }}
              />
            ) : (
              <div class="fp-loading">جارٍ تحميل الصفحة…</div>
            )}
          </div>

          <div class="fp-pagebar">
            <button
              class="icon-btn"
              aria-label="الصفحة السابقة"
              disabled={viewPage.value <= c.pages[0]}
              onClick={() => {
                userMovedAt.current = Date.now();
                viewPage.value = Math.max(c.pages[0], viewPage.value - 1);
              }}
            >
              <Icon name="chevronRight" size={20} />
            </button>
            <span>
              صفحة {arNum(viewPage.value)}
              <small> · من {arNum(c.pages[0])} إلى {arNum(c.pages[1])}</small>
            </span>
            <button
              class="icon-btn"
              aria-label="الصفحة التالية"
              disabled={viewPage.value >= c.pages[1]}
              onClick={() => {
                userMovedAt.current = Date.now();
                viewPage.value = Math.min(c.pages[1], viewPage.value + 1);
              }}
            >
              <Icon name="chevronLeft" size={20} />
            </button>
            {Date.now() - userMovedAt.current < 8000 && ayah > 0 && (
              <button class="chip" onClick={() => (userMovedAt.current = 0, text.value && (viewPage.value = text.value.p[ayah - 1]))}>
                عُد للآية {arNum(ayah)}
              </button>
            )}
          </div>

          <footer class="fp-foot">
            <button class="fp-reciter" onClick={() => (pickReciter.value = true)}>
              <Icon name="mic" size={18} />
              <span>
                <strong>{t.recitation.name}</strong>
                <small>{styleLabel(t.recitation)}</small>
              </span>
              <Icon name="chevronDown" size={18} />
            </button>

            {status.value === 'error' && <p class="fp-error">{errorText.value}</p>}

            <div class="fp-seek">
              <span class="fp-time">{clock(time.value)}</span>
              <input
                type="range"
                min={0}
                max={duration.value || 1}
                step={0.1}
                value={time.value}
                onInput={(e) => seek(Number(e.currentTarget.value))}
                aria-label="موضع التلاوة"
                style={{ '--pct': `${duration.value ? (time.value / duration.value) * 100 : 0}%` }}
              />
              <span class="fp-time">{clock(duration.value)}</span>
            </div>

            <div class="fp-controls">
              <button
                class={`icon-btn${repeat.value === 'surah' ? ' on' : ''}`}
                onClick={cycleRepeat}
                aria-label={repeat.value === 'surah' ? 'إيقاف تكرار السورة' : 'تكرار السورة'}
                aria-pressed={repeat.value === 'surah'}
              >
                <Icon name="repeat" size={20} />
              </button>
              <button class="icon-btn" onClick={prev} aria-label="السورة السابقة">
                <Icon name="prev" size={22} />
              </button>
              <button class="icon-btn" onClick={() => skip(-10)} aria-label="رجوع ١٠ ثوانٍ">
                <span class="skip-label ltr-num">-١٠</span>
              </button>
              <button class={`play-btn lg${status.value === 'loading' ? ' loading' : ''}`} onClick={toggle} aria-label={status.value === 'playing' ? 'إيقاف مؤقت' : 'تشغيل'}>
                <Icon name={status.value === 'playing' ? 'pause' : 'play'} size={28} />
              </button>
              <button class="icon-btn" onClick={() => skip(10)} aria-label="تقديم ١٠ ثوانٍ">
                <span class="skip-label ltr-num">+١٠</span>
              </button>
              <button class="icon-btn" onClick={next} aria-label="السورة التالية">
                <Icon name="next" size={22} />
              </button>
              <button
                class={`icon-btn${sleepAt.value || sleepEndOfSurah.value ? ' on' : ''}`}
                onClick={() => (sleepMenu.value = true)}
                aria-label="مؤقت النوم"
              >
                <Icon name="timer" size={20} />
              </button>
            </div>

            <div class="fp-extra">
              <div class="rate-group" role="group" aria-label="سرعة التلاوة">
                {RATES.map((r) => (
                  <button key={r} class={rate.value === r ? 'active' : ''} onClick={() => setRate(r)} aria-pressed={rate.value === r}>
                    {arNum(r)}×
                  </button>
                ))}
              </div>
              {ayahLoop.value ? (
                <button class="chip active" onClick={() => (ayahLoop.value = null, repeat.value = 'off')}>
                  <Icon name="repeatOne" size={14} /> تكرار الآية {arNum(ayahLoop.value.ayah)} (
                  {Number.isFinite(ayahLoop.value.left) ? `باقي ${arNum(ayahLoop.value.left)}` : 'مستمر'}) ✕
                </button>
              ) : (
                <button
                  class="chip"
                  disabled={!timings.value || !ayah}
                  onClick={() => (loopMenu.value = ayah)}
                  title="للحفظ: كرر الآية الحالية"
                >
                  <Icon name="repeatOne" size={14} /> كرر الآية
                </button>
              )}
            </div>
          </footer>
        </div>
      </Sheet>

      <ReciterPicker
        open={pickReciter.value}
        onClose={() => (pickReciter.value = false)}
        surah={t.surah}
        onPick={(r) => {
          pickReciter.value = false;
          changeRecitation(r.id);
        }}
      />

      <Sheet open={sleepMenu.value} onClose={() => (sleepMenu.value = false)} title="مؤقت النوم">
        <div class="option-grid">
          {[5, 10, 15, 30, 45, 60].map((m) => (
            <button
              key={m}
              class="option"
              onClick={() => {
                setSleep(m);
                sleepMenu.value = false;
              }}
            >
              {arNum(m)} دقيقة
            </button>
          ))}
          <button
            class="option"
            onClick={() => {
              setSleep('end');
              sleepMenu.value = false;
            }}
          >
            نهاية السورة
          </button>
          <button
            class="option muted"
            onClick={() => {
              setSleep(null);
              sleepMenu.value = false;
            }}
          >
            إيقاف المؤقت
          </button>
        </div>
        {(sleepAt.value || sleepEndOfSurah.value) && (
          <p class="hint center">
            {sleepEndOfSurah.value
              ? 'سيتوقف التشغيل بنهاية السورة.'
              : `سيتوقف التشغيل بعد ${arNum(Math.max(1, Math.round(((sleepAt.value ?? 0) - Date.now()) / 60000)))} دقيقة.`}
          </p>
        )}
      </Sheet>

      <Sheet open={loopMenu.value != null} onClose={() => (loopMenu.value = null)} title={`تكرار الآية ${arNum(loopMenu.value ?? 0)}`}>
        <p class="hint">للحفظ والمراجعة: تُعاد الآية بعدد المرات المختار ثم يكمل التشغيل.</p>
        <div class="option-grid">
          {[2, 3, 5, 7, 10, Infinity].map((n) => (
            <button
              key={n}
              class="option"
              onClick={() => {
                if (loopMenu.value) loopAyah(loopMenu.value, n, t.surah);
                loopMenu.value = null;
              }}
            >
              {n === 2 ? 'مرتان' : Number.isFinite(n) ? `${arNum(n)} مرات` : 'بدون توقف'}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
