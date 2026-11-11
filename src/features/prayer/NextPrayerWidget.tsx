/**
 * Compact "next prayer" card for the Home screen: name, time, live countdown,
 * links to /prayer. Importing it has no side effects; on mount it starts the
 * in-app reminders (if enabled) and the one-time v3 city migration.
 */
import { useEffect, useMemo } from 'preact/hooks';
import { countdown } from '../../lib/format';
import { prefs } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { timeParts } from './calc';
import { PrayerGlyph } from './glyphs';
import { calcSettings, migrateLegacyCity, nextPrayerNow, prayerLocation } from './prayer-state';
import { startPrayerReminders } from './reminders';
import { useNow } from './useNow';
import './widget.css';

export function NextPrayerWidget({ class: cls }: { class?: string }) {
  const now = useNow(1000);
  const loc = prayerLocation.value;
  const settings = calcSettings.value;
  const minute = Math.floor(now / 60_000);

  useEffect(() => {
    void migrateLegacyCity();
    startPrayerReminders();
  }, []);

  const cached = useMemo(() => nextPrayerNow(new Date(now)), [minute, loc, settings]);
  const next = cached.time.getTime() <= now ? nextPrayerNow(new Date(now)) : cached;
  const t = timeParts(next.time, loc.tz, prefs.value.hour12);
  const left = Math.max(0, (next.time.getTime() - now) / 1000);

  return (
    <a href="/prayer" class={`npw card${cls ? ` ${cls}` : ''}`}>
      <span class="npw-icon">
        <PrayerGlyph name={next.key} size={24} />
      </span>
      <span class="npw-main">
        <span class="npw-kicker">
          {next.tomorrow ? 'الصلاة القادمة · غدًا' : 'الصلاة القادمة'} · {loc.name}
        </span>
        <span class="npw-line">
          <span class="npw-name">{next.label}</span>
          <span class="npw-time">
            {t.time}
            {t.period && <small>{t.period}</small>}
          </span>
        </span>
      </span>
      <span class="npw-count">
        <span class="npw-count-label">بعد</span>
        <span class="npw-count-value" role="timer">
          {Number.isFinite(left) ? countdown(left) : '—'}
        </span>
      </span>
      <Icon name="chevronLeft" size={18} class="npw-chev" />
    </a>
  );
}

export default NextPrayerWidget;
