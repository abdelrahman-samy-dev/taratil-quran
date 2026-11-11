import { useEffect, useMemo, useState } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { countdown, gregorianDate, hijriDate, timeOfDay } from '../../lib/format';
import { prefs } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { PageHeader } from '../../ui/kit';
import {
  type DayTimes,
  type NextPrayer,
  type PrayerKey,
  TIME_KEYS,
  addDaysYMD,
  computeDay,
  methodInfo,
  prayerLabel,
  qiblaBearing,
  timeParts,
} from './calc';
import { placeLabel } from './geo';
import { PrayerGlyph } from './glyphs';
import { LocationSheet } from './LocationSheet';
import { MonthSheet } from './MonthSheet';
import { calcSettings, effectiveMethod, isDefaultLocation, migrateLegacyCity, nextPrayerNow, prayerLocation, prayerSettings } from './prayer-state';
import { startPrayerReminders } from './reminders';
import { SettingsSheet } from './SettingsSheet';
import { useNow } from './useNow';
import './prayer.css';

type SheetName = 'location' | 'settings' | 'month' | null;

/** Live countdown + progress since the previous prayer; ticks on its own. */
function HeroTimer({ next, onDone }: { next: NextPrayer; onDone: () => void }) {
  const now = useNow(1000);
  const left = Math.max(0, (next.time.getTime() - now) / 1000);
  const span = next.time.getTime() - next.since.getTime();
  const pct = span > 0 ? Math.min(100, Math.max(0, ((now - next.since.getTime()) / span) * 100)) : 0;

  useEffect(() => {
    if (left <= 0) onDone();
  }, [left <= 0]);

  return (
    <div class="pr-hero-timer">
      <span class="pr-hero-kicker">متبقٍّ على الأذان</span>
      <span class="pr-hero-count" role="timer" aria-label={`متبقٍّ ${Number.isFinite(left) ? countdown(left) : ''}`}>
        {Number.isFinite(left) ? countdown(left) : '—'}
      </span>
      <div class="pr-hero-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TimeText({ date, tz, hour12 }: { date: Date; tz: string; hour12: boolean }) {
  const t = timeParts(date, tz, hour12);
  return (
    <span class="pr-time-text">
      {t.time}
      {t.period && <small>{t.period}</small>}
    </span>
  );
}

function TimeCard({ k, day, next, tz, hour12 }: { k: PrayerKey; day: DayTimes; next: NextPrayer; tz: string; hour12: boolean }) {
  const isNext = !next.tomorrow && next.key === k;
  const isCurrent = next.current === k && k !== 'sunrise' && !isNext;
  const passed = !isNext && !isCurrent && next.current != null && TIME_KEYS.indexOf(k) <= TIME_KEYS.indexOf(next.current);
  const cls = `pr-time card${isNext ? ' is-next' : ''}${isCurrent ? ' is-current' : ''}${passed ? ' is-passed' : ''}${k === 'sunrise' ? ' is-marker' : ''}`;
  return (
    <li class={cls} aria-current={isNext ? 'time' : undefined}>
      <span class="pr-time-icon">
        <PrayerGlyph name={k} size={22} />
      </span>
      <span class="pr-time-name">{prayerLabel(k, day.friday)}</span>
      <TimeText date={day.times[k]} tz={tz} hour12={hour12} />
      {isNext && <span class="tag tag-primary pr-time-tag">القادمة</span>}
      {isCurrent && <span class="tag tag-accent pr-time-tag">الوقت الحالي</span>}
    </li>
  );
}

export default function PrayerPage() {
  const [sheet, setSheet] = useState<SheetName>(null);
  const [bump, setBump] = useState(0);
  const minute = useNow(30_000);
  const loc = prayerLocation.value;
  const settings = calcSettings.value;
  const hour12 = prefs.value.hour12;

  useEffect(() => {
    void migrateLegacyCity();
    startPrayerReminders();
  }, []);

  const now = new Date(Math.max(minute, Date.now()));
  // Recompute when the minute ticks, a prayer time passes, or settings change.
  const next = useMemo(() => nextPrayerNow(now), [minute, bump, loc, settings]);
  const day = next.day;
  // Before Fajr we are still in last night: show its Sunnah times.
  const nightDay = useMemo(
    () => (now < day.times.fajr ? computeDay(loc, settings, addDaysYMD(day.ymd, -1)) : day),
    [day, now < day.times.fajr],
  );
  const nextTime = timeParts(next.time, loc.tz, hour12);
  const bearing = qiblaBearing(loc.lat, loc.lon);
  const close = () => setSheet(null);
  const s = prayerSettings.value;

  return (
    <div class="pr-page">
      <PageHeader
        title="مواقيت الصلاة"
        subtitle="تُحسب على جهازك وتعمل دون اتصال"
        actions={
          <>
            <button class="btn btn-ghost" onClick={() => setSheet('month')} aria-haspopup="dialog">
              <Icon name="calendar" size={18} /> جدول الشهر
            </button>
            <button class="btn btn-ghost" onClick={() => setSheet('settings')} aria-haspopup="dialog">
              <Icon name="sliders" size={18} /> الإعدادات
            </button>
          </>
        }
      />

      {isDefaultLocation.value && (
        <div class="pr-default card" role="note">
          <span class="pr-default-icon">
            <Icon name="mapPin" size={20} />
          </span>
          <p>
            <strong>تُعرض مواقيت القاهرة افتراضيًا.</strong> حدِّد موقعك لتحصل على مواقيت دقيقة لمدينتك.
          </p>
          <button class="btn" onClick={() => setSheet('location')} aria-haspopup="dialog">
            حدِّد موقعي
          </button>
        </div>
      )}

      <section class="pr-hero" aria-labelledby="pr-next-title">
        <div class="pr-hero-top">
          <button
            class="pr-hero-place"
            onClick={() => setSheet('location')}
            aria-haspopup="dialog"
            aria-label={`الموقع: ${placeLabel(loc)}. تغيير الموقع`}
          >
            <Icon name="mapPin" size={18} />
            <span>{placeLabel(loc)}</span>
            <span class="pr-hero-change">تغيير</span>
          </button>
          <div class="pr-hero-dates">
            <span class="pr-hero-hijri">{hijriDate(now, prefs.value.hijriAdjust, loc.tz)}</span>
            <span class="pr-hero-greg">{gregorianDate(now, loc.tz)}</span>
          </div>
        </div>

        <div class="pr-hero-main">
          <div class="pr-hero-next" aria-live="polite" aria-atomic="true">
            <span class="pr-hero-kicker">{next.tomorrow ? 'الصلاة القادمة · غدًا' : 'الصلاة القادمة'}</span>
            <h2 id="pr-next-title" class="pr-hero-name">
              {next.label}
            </h2>
            <span class="pr-hero-time">
              {nextTime.time} {nextTime.period && <small>{nextTime.period}</small>}
            </span>
          </div>
          <HeroTimer next={next} onDone={() => setBump((b) => b + 1)} />
        </div>

        {next.current === 'fajr' && (
          <p class="pr-hero-note">
            <PrayerGlyph name="sunrise" size={16} /> يخرج وقت الفجر بشروق الشمس {timeOfDay(day.times.sunrise, loc.tz, hour12)}
          </p>
        )}
      </section>

      <h2 class="section-title">
        <span>مواقيت اليوم</span>
        <span class="pr-method-line">{methodInfo(effectiveMethod.value).name}</span>
      </h2>
      <ol class="pr-times" aria-label="مواقيت اليوم">
        {TIME_KEYS.map((k) => (
          <TimeCard key={k} k={k} day={day} next={next} tz={loc.tz} hour12={hour12} />
        ))}
      </ol>

      <div class="pr-extra">
        <div class="pr-sunnah card">
          <h2 class="pr-extra-title">
            <Icon name="moon" size={18} /> قيام الليل
          </h2>
          <dl class="pr-sunnah-list">
            <div>
              <dt>منتصف الليل</dt>
              <dd>
                <TimeText date={nightDay.middleOfNight} tz={loc.tz} hour12={hour12} />
              </dd>
            </div>
            <div>
              <dt>بداية الثلث الأخير</dt>
              <dd>
                <TimeText date={nightDay.lastThird} tz={loc.tz} hour12={hour12} />
              </dd>
            </div>
          </dl>
          <p class="hint">يُحسب الليل هنا من المغرب إلى الفجر.</p>
        </div>

        <a href="/qibla" class="pr-qibla-link card">
          <span class="pr-qibla-dial" aria-hidden="true">
            <span style={{ transform: `rotate(${bearing}deg)` }} />
          </span>
          <span class="pr-qibla-text">
            <span class="pr-extra-title">اتجاه القبلة</span>
            <span class="hint">
              {arNum(Math.round(bearing))}° من الشمال · {loc.name}
            </span>
          </span>
          <Icon name="chevronLeft" size={20} />
        </a>
      </div>

      <p class="hint pr-foot">
        العصر: {s.madhab === 'hanafi' ? 'الحنفي' : 'الجمهور'}
        {TIME_KEYS.some((k) => s.adjustments[k]) ? ' · مع تعديل يدوي' : ''} · بتوقيت {loc.name} المحلي
        {' · '}
        <button class="pr-link" onClick={() => setSheet('settings')}>
          تغيير الإعدادات
        </button>
      </p>

      <LocationSheet open={sheet === 'location'} onClose={close} />
      <SettingsSheet open={sheet === 'settings'} onClose={close} />
      <MonthSheet open={sheet === 'month'} onClose={close} />
    </div>
  );
}
