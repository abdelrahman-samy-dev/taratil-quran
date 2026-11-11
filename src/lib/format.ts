import { arNum } from './arabic';

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '٠:٠٠';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  const out = `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
  return arNum(out);
}

/** Countdown "٢:٠٥:٠٩" from a number of seconds. */
export function countdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return arNum(`${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
}

const timeFmt = new Map<string, Intl.DateTimeFormat>();

/** "٤:٤٨ ص" in a given IANA time zone (defaults to the device zone). */
export function timeOfDay(date: Date, timeZone?: string, hour12 = true): string {
  const key = `${timeZone ?? ''}|${hour12}`;
  let f = timeFmt.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', hour12, timeZone });
    timeFmt.set(key, f);
  }
  return f.format(date);
}

export function gregorianDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
}

/** Hijri (Umm al-Qura) date, with an optional day adjustment. */
export function hijriDate(date: Date, adjustDays = 0, timeZone?: string): string {
  const d = new Date(date.getTime() + adjustDays * 86_400_000);
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(d);
  } catch {
    return '';
  }
}

export function bytes(n: number): string {
  if (n < 1024) return `${arNum(n)} بايت`;
  if (n < 1024 ** 2) return `${arNum((n / 1024).toFixed(0))} ك.ب`;
  if (n < 1024 ** 3) return `${arNum((n / 1024 ** 2).toFixed(1))} م.ب`;
  return `${arNum((n / 1024 ** 3).toFixed(2))} ج.ب`;
}
