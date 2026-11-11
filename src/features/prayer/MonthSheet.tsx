import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { prefs } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { PRAYER_NAMES, TIME_KEYS, monthTimes, timeParts, weekdayOf, ymdKey, zonedYMD } from './calc';
import { calcSettings, prayerLocation } from './prayer-state';

const monthFmt = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekdayFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'UTC' });

function hijriMonth(y: number, m: number, d: number, adjust: number): { month: string; year: string } {
  try {
    const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(new Date(Date.UTC(y, m - 1, d + adjust, 12)));
    return {
      month: parts.find((p) => p.type === 'month')?.value ?? '',
      year: parts.find((p) => p.type === 'year')?.value ?? '',
    };
  } catch {
    return { month: '', year: '' };
  }
}

function hijriRange(a: { month: string; year: string }, b: { month: string; year: string }): string {
  if (!a.month) return '';
  if (a.month === b.month && a.year === b.year) return `${a.month} ${a.year} هـ`;
  if (a.year === b.year) return `${a.month} – ${b.month} ${b.year} هـ`;
  return `${a.month} ${a.year} – ${b.month} ${b.year} هـ`;
}

/** The month's timetable for the saved location, one row per day. */
export function MonthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = prayerLocation.value;
  const settings = calcSettings.value;
  const hour12 = prefs.value.hour12;
  const adjust = prefs.value.hijriAdjust;
  const today = zonedYMD(new Date(), loc.tz);
  const [offset, setOffset] = useState(0);
  const todayRow = useRef<HTMLTableRowElement>(null);
  const nav = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setOffset(0);
  }, [open]);

  const first = new Date(Date.UTC(today.y, today.m - 1 + offset, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  const days = useMemo(() => (open ? monthTimes(loc, settings, y, m) : []), [open, loc, settings, y, m]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (offset === 0 && todayRow.current) todayRow.current.scrollIntoView({ block: 'center' });
      else nav.current?.closest('.sheet-body')?.scrollTo({ top: 0 });
    });
  }, [open, offset]);

  const hFirst = hijriMonth(y, m, 1, adjust);
  const hLast = hijriMonth(y, m, days.length || 28, adjust);
  const todayKey = ymdKey(today);

  return (
    <Sheet open={open} onClose={onClose} title="جدول الشهر" class="pr-month-sheet">
      <div class="pr-month-nav" ref={nav}>
        <button class="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label="الشهر السابق">
          <Icon name="chevronRight" size={20} />
        </button>
        <div class="pr-month-title" aria-live="polite">
          <strong>{monthFmt.format(first)}</strong>
          <span>{hijriRange(hFirst, hLast)}</span>
        </div>
        <button class="icon-btn" onClick={() => setOffset((o) => o + 1)} aria-label="الشهر التالي">
          <Icon name="chevronLeft" size={20} />
        </button>
      </div>
      <div class="pr-month-wrap">
        <table class="pr-month-table">
          <caption class="sr-only">
            مواقيت الصلاة لشهر {monthFmt.format(first)} في {loc.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">اليوم</th>
              {TIME_KEYS.map((k) => (
                <th key={k} scope="col">
                  {PRAYER_NAMES[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const key = ymdKey(day.ymd);
              const isToday = key === todayKey;
              const wd = weekdayOf(day.ymd);
              return (
                <tr
                  key={key}
                  ref={isToday ? todayRow : undefined}
                  class={`${isToday ? 'today' : ''}${wd === 5 ? ' friday' : ''}`}
                  aria-current={isToday ? 'date' : undefined}
                >
                  <th scope="row">
                    <span class="pr-month-day">{arNum(day.ymd.d)}</span>
                    <span class="pr-month-wd">{weekdayFmt.format(new Date(Date.UTC(day.ymd.y, day.ymd.m - 1, day.ymd.d)))}</span>
                  </th>
                  {TIME_KEYS.map((k) => (
                    <td key={k}>{timeParts(day.times[k], loc.tz, hour12).time}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {offset !== 0 && (
        <button class="btn btn-ghost pr-month-today" onClick={() => setOffset(0)}>
          العودة إلى الشهر الحالي
        </button>
      )}
      <p class="hint pr-month-note">
        الأوقات بتوقيت {loc.name} المحلي، وأيام الجمعة مظلَّلة.
      </p>
    </Sheet>
  );
}
