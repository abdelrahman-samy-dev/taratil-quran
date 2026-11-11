import { prefs } from '../state/prefs';
import { toast } from '../ui/toast';

/** Short haptic tap; respects the user's setting and device support. */
export function haptic(pattern: number | number[] = 12): void {
  if (!prefs.value.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export async function copyText(text: string, label = 'تم النسخ'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    // Fallback for older WebViews
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(label);
  }
}

export async function shareText(text: string, title = 'تراتيل'): Promise<void> {
  const url = location.origin;
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `${text}\n\n${url}` });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
  }
  await copyText(`${text}\n\n${url}`, 'تم نسخ النص للمشاركة');
}

let wakeLock: WakeLockSentinel | null = null;
let wakeLockWanted = false;

/** Keep the screen on while reading (Mushaf, Azkar). */
export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* not allowed (e.g. battery saver) */
  }
}

document.addEventListener('visibilitychange', () => {
  // The browser drops the lock when hidden; re-acquire when we come back.
  if (document.visibilityState === 'visible' && wakeLockWanted) void keepAwake(true);
});

export function setWakeLockWanted(on: boolean): void {
  wakeLockWanted = on;
  void keepAwake(on);
}
