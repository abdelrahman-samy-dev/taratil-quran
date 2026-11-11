import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import {
  RATES,
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
import { BASMALA, chapter, placeLabel, surahText, type SurahText } from '../quran/data';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

export function FullPlayer() {
  const t = track.value;
  const open = fullPlayerOpen.value && t?.kind === 'surah';
  const text = useSignal<SurahText | null>(null);
  const pickReciter = useSignal(false);
  const sleepMenu = useSignal(false);
  const loopMenu = useSignal<number | null>(null);
  const userScrolledAt = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const surah = t?.kind === 'surah' ? t.surah : 0;

  useEffect(() => {
    if (!open || !surah) return;
    text.value = null;
    surahText(surah)
      .then((d) => (text.value = d))
      .catch(() => (text.value = null));
  }, [open, surah]);

  // Keep the recited verse in view unless the user is scrolling around.
  const ayah = currentAyah.value;
  useEffect(() => {
    if (!open || !ayah || Date.now() - userScrolledAt.current < 4000) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-ayah="${ayah}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [ayah, open]);

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
            class="fp-verses quran-text"
            ref={listRef}
            onWheel={() => (userScrolledAt.current = Date.now())}
            onTouchMove={() => (userScrolledAt.current = Date.now())}
          >
            {!text.value ? (
              <div class="fp-loading">جارٍ تحميل الآيات…</div>
            ) : (
              <>
                {c.bismillah && <p class="fp-basmala">{BASMALA}</p>}
                {text.value.v.map((v, i) => {
                  const n = i + 1;
                  const state = n === ayah ? 'active' : n < ayah ? 'past' : '';
                  const looping = ayahLoop.value?.ayah === n;
                  return (
                    <span
                      key={n}
                      data-ayah={n}
                      class={`fp-verse ${state}${looping ? ' looping' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        userScrolledAt.current = 0;
                        if (timings.value) seekToAyah(n);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        loopMenu.value = n;
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && timings.value && seekToAyah(n)}
                    >
                      {v} <span class="ayah-num">{arNum(n)}</span>{' '}
                    </span>
                  );
                })}
              </>
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
                if (loopMenu.value) loopAyah(loopMenu.value, n);
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
