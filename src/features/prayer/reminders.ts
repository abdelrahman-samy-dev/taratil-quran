/**
 * In-app prayer reminders. Runs only while the app is open: no push server,
 * no background sync. Idempotent — call `startPrayerReminders()` from any screen.
 */
import { timeOfDay } from '../../lib/format';
import { prefs } from '../../state/prefs';
import { toast } from '../../ui/toast';
import { SALAH_KEYS, addDaysYMD, computeDay, isValidDate, prayerLabel, ymdKey, zonedYMD } from './calc';
import { calcSettings, prayerLocation, prayerSettings, setPrayerSetting } from './prayer-state';

/** Ignore times that passed more than this long ago (app was asleep). */
const LATE_MS = 10 * 60_000;

let started = false;
const fired = new Set<string>();

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

async function show(title: string, body: string, tag: string) {
  if (notificationPermission() !== 'granted') return;
  const opts: NotificationOptions = { body, tag, lang: 'ar', dir: 'rtl', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' };
  try {
    // Android Chrome only allows notifications through the service worker.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, opts);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, opts);
  } catch {
    /* not allowed here; the toast still shows */
  }
}

function check(lastCheck: number, now: number) {
  if (!prayerSettings.value.notify) return;
  const loc = prayerLocation.value;
  const settings = calcSettings.value;
  const today = zonedYMD(new Date(now), loc.tz);
  // Yesterday too: at high latitudes Isha can fall after midnight.
  for (const ymd of [addDaysYMD(today, -1), today]) {
    const day = computeDay(loc, settings, ymd, false);
    for (const key of SALAH_KEYS) {
      const t = day.times[key];
      if (!isValidDate(t)) continue;
      const at = t.getTime();
      const id = `${ymdKey(ymd)}:${key}`;
      if (at > lastCheck && at <= now && now - at < LATE_MS && !fired.has(id)) {
        fired.add(id);
        const text = `حان الآن وقت صلاة ${prayerLabel(key, day.friday)}`;
        toast(text, undefined, 8000);
        void show(text, `${timeOfDay(t, loc.tz, prefs.value.hour12)} · ${loc.name}`, `prayer-${key}`);
      }
    }
  }
}

export function startPrayerReminders(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  let last = Date.now();
  const tick = () => {
    const now = Date.now();
    try {
      check(last, now);
    } finally {
      last = now;
    }
  };
  window.setInterval(tick, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

/**
 * Turn reminders on/off. Asks for notification permission on enable; if the
 * user refuses, reminders still show as in-app toasts.
 */
export async function setReminders(on: boolean): Promise<void> {
  setPrayerSetting('notify', on);
  if (!on) return;
  startPrayerReminders();
  if (!notificationsSupported()) {
    toast('سيظهر التنبيه داخل التطبيق فقط؛ المتصفح لا يدعم الإشعارات');
    return;
  }
  let perm = Notification.permission;
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = 'denied';
    }
  }
  toast(perm === 'granted' ? 'سيصلك تنبيه عند دخول وقت الصلاة ما دام التطبيق مفتوحًا' : 'لم يُسمح بالإشعارات؛ سيظهر التنبيه داخل التطبيق فقط');
}
