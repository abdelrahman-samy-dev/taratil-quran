import { signal } from '@preact/signals';
import { Icon } from '../ui/Icon';

/** Set by main.tsx when a new service worker is waiting. */
export const updateReady = signal<null | (() => void)>(null);
export const offline = signal(typeof navigator !== 'undefined' && !navigator.onLine);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => (offline.value = false));
  window.addEventListener('offline', () => (offline.value = true));
}

export function UpdateBanner() {
  return (
    <>
      {updateReady.value && (
        <div class="banner" role="status">
          <Icon name="download" size={18} />
          <span>نسخة جديدة من تراتيل جاهزة.</span>
          <button class="btn btn-sm" onClick={() => updateReady.value?.()}>
            تحديث الآن
          </button>
        </div>
      )}
      {offline.value && (
        <div class="banner muted" role="status">
          <Icon name="wifiOff" size={18} />
          <span>أنت غير متصل. المصحف والأذكار والمواقيت تعمل كالمعتاد.</span>
        </div>
      )}
    </>
  );
}
