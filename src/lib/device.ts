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
let holders = 0;

async function applyWakeLock(): Promise<void> {
  const want = holders > 0 && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
      // Released while the request was in flight.
      if (holders === 0) void wakeLock.release();
    } else if (!want && wakeLock && holders === 0) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* not allowed (e.g. battery saver) */
  }
}

// The browser drops the lock when the page is hidden; take it again on return.
document.addEventListener('visibilitychange', () => void applyWakeLock());

/**
 * Keep the screen on while a reading screen is open. Returns a release function;
 * the lock stays while at least one screen holds it (so screen changes never race).
 */
export function holdWakeLock(): () => void {
  holders++;
  void applyWakeLock();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    void applyWakeLock();
  };
}
