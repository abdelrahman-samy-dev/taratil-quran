import { signal } from '@preact/signals';
import { persisted } from '../lib/storage';
import { toast } from '../ui/toast';

/** Cache shared with the service worker, which serves these files with Range support. */
export const AUDIO_CACHE = 'taratil-audio-offline';

/** url → 'done' | progress (0..1) */
export const downloadState = signal<Record<string, 'done' | number>>({});
export const downloads = persisted<{ url: string; title: string; size: number; at: number }[]>('downloads', []);

for (const d of downloads.value) downloadState.value[d.url] = 'done';

function setState(url: string, v: 'done' | number | null) {
  const next = { ...downloadState.value };
  if (v == null) delete next[url];
  else next[url] = v;
  downloadState.value = next;
}

export async function downloadSurah(url: string, title: string): Promise<void> {
  if (!('caches' in window)) return toast('المتصفح لا يدعم التحميل للاستماع بدون إنترنت');
  if (typeof downloadState.value[url] === 'number') return;
  setState(url, 0);
  try {
    // Ask the browser to keep our data even under storage pressure.
    void navigator.storage?.persist?.();
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok || !res.body) throw new Error(String(res.status));
    const total = Number(res.headers.get('content-length')) || 0;
    // Stream straight into the cache (long surahs can be 100+ MB): one branch is stored,
    // the other only counts bytes for the progress ring.
    const [toCache, toCount] = res.body.tee();
    const cache = await caches.open(AUDIO_CACHE);
    const stored = cache.put(
      url,
      new Response(toCache, {
        headers: { 'Content-Type': 'audio/mpeg', ...(total ? { 'Content-Length': String(total) } : {}) },
      }),
    );
    const reader = toCount.getReader();
    let got = 0;
    let lastPaint = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (total && Date.now() - lastPaint > 150) {
        lastPaint = Date.now();
        setState(url, got / total);
      }
    }
    await stored;
    const blob = { size: got || total };
    downloads.value = [...downloads.value.filter((d) => d.url !== url), { url, title, size: blob.size, at: Date.now() }];
    setState(url, 'done');
    toast(`تم تحميل ${title}`);
  } catch {
    setState(url, null);
    toast('تعذر التحميل. تأكد من الاتصال وحاول مرة أخرى.');
  }
}

export async function removeDownload(url: string): Promise<void> {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    await cache.delete(url);
  } catch {
    /* ignore */
  }
  downloads.value = downloads.value.filter((d) => d.url !== url);
  setState(url, null);
}

export async function clearDownloads(): Promise<void> {
  try {
    await caches.delete(AUDIO_CACHE);
  } catch {
    /* ignore */
  }
  downloads.value = [];
  downloadState.value = {};
}
