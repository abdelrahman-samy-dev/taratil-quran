import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { Icon } from '../../ui/Icon';
import { Progress } from '../../ui/kit';
import { azkarMeta, azkarSummary, suggestedCategory } from '../azkar/azkar-state';
import { NextPrayerWidget } from '../prayer/NextPrayerWidget';

/** Home widgets contributed by other features (prayer, azkar, hadith). */
export function HomeWidgets() {
  return (
    <>
      <NextPrayerWidget class="home-prayer" />
      <AzkarWidget />
    </>
  );
}

function AzkarWidget() {
  const cat = suggestedCategory();
  const meta = azkarMeta(cat);
  const s = azkarSummary(cat);
  if (!meta) return null;
  return (
    <a href={`/azkar/${cat}`} class="home-card card azkar-widget">
      <span class={`home-card-icon${s.complete ? '' : ' accent'}`}>
        <Icon name={s.complete ? 'check' : cat === 'morning' ? 'sun' : 'moon'} size={20} />
      </span>
      <span class="home-card-text">
        <span class="home-card-label">{s.complete ? 'أتممتها اليوم، تقبّل الله' : 'حان وقتها'}</span>
        <span class="home-card-title">{meta.title}</span>
        <span class="azkar-widget-progress">
          <Progress value={s.done} max={s.total} label={meta.title} />
          <span class="home-card-sub">
            {arNum(s.done)} من {arNum(s.total)}
          </span>
        </span>
      </span>
      <Icon name="chevronLeft" size={20} />
    </a>
  );
}

/** Loaded after the page is up; placed below the fold so it never shifts content. */
export function HadithWidget() {
  const h = useSignal<null | { text: string; number: number; bookName: string; href: string }>(null);
  useEffect(() => {
    let alive = true;
    import('../hadith/daily')
      .then((m) => m.hadithOfTheDay())
      .then((d) => alive && (h.value = d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!h.value) return null;
  return (
    <a href={h.value.href} class="home-hadith card">
      <span class="home-hadith-head">
        <Icon name="library" size={18} /> حديث اليوم
        <span class="tag">
          {h.value.bookName} · {arNum(h.value.number)}
        </span>
      </span>
      <span class="home-hadith-text">{h.value.text}</span>
      <span class="home-hadith-more">
        اقرأ الحديث كاملًا <Icon name="chevronLeft" size={16} />
      </span>
    </a>
  );
}
