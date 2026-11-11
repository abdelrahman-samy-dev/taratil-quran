import {
  currentAyah,
  duration,
  errorText,
  fullPlayerOpen,
  isPlaying,
  next,
  prev,
  status,
  stop,
  time,
  toggle,
  track,
} from '../audio/player';
import { arNum } from '../lib/arabic';
import { chapter } from '../quran/data';
import { Icon } from '../ui/Icon';

export function MiniPlayer() {
  const t = track.value;
  if (!t) return null;
  const radio = t.kind === 'radio';
  const title = radio ? t.name : `سورة ${chapter(t.surah).ar}`;
  const sub =
    status.value === 'error'
      ? errorText.value || 'تعذر التشغيل'
      : radio
        ? status.value === 'loading'
          ? 'جارٍ الاتصال…'
          : t.id.startsWith('live-')
            ? 'بث مباشر'
            : 'بث متواصل'
        : `${t.recitation.name}${currentAyah.value ? ` · الآية ${arNum(currentAyah.value)}` : ''}`;
  const pct = !radio && duration.value ? (time.value / duration.value) * 100 : 0;

  return (
    <div class={`mini-player${status.value === 'error' ? ' is-error' : ''}`} role="region" aria-label="مشغل التلاوة">
      {!radio && (
        <div class="mini-progress" aria-hidden="true">
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
      <button
        class="mini-info"
        onClick={() => !radio && (fullPlayerOpen.value = true)}
        aria-label={radio ? title : `فتح المشغل: ${title}`}
        disabled={radio}
      >
        <span class={`mini-art${isPlaying.value ? ' playing' : ''}`} aria-hidden="true">
          {radio ? <Icon name="radio" size={20} /> : <span class="mini-art-num">{arNum(t.surah)}</span>}
        </span>
        <span class="mini-text">
          <span class="mini-title">
            {radio && <span class="live-dot" aria-hidden="true" />}
            {title}
          </span>
          <span class="mini-sub">{sub}</span>
        </span>
      </button>
      <div class="mini-controls">
        {!radio && (
          <button class="icon-btn hide-sm" onClick={prev} aria-label="السورة السابقة">
            <Icon name="prev" size={18} />
          </button>
        )}
        <button
          class={`play-btn${status.value === 'loading' ? ' loading' : ''}`}
          onClick={toggle}
          aria-label={isPlaying.value ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          <Icon name={status.value === 'playing' ? 'pause' : 'play'} size={20} />
        </button>
        {!radio && (
          <button class="icon-btn hide-sm" onClick={next} aria-label="السورة التالية">
            <Icon name="next" size={18} />
          </button>
        )}
        <button class="icon-btn" onClick={stop} aria-label="إغلاق المشغل">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}
