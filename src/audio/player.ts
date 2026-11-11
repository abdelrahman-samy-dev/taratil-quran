/**
 * The one audio engine for the app: surah recitations (with verse timings) and
 * live radio. UI components only read the signals and call the actions below.
 */
import { batch, computed, effect, signal } from '@preact/signals';
import { persisted } from '../lib/storage';
import { chapter } from '../quran/data';
import { addListenSeconds, bumpStat } from '../state/progress';
import { prefs } from '../state/prefs';
import { toast } from '../ui/toast';
import { findRecitation, loadRecitations, surahUrl, type Recitation } from './reciters';
import { estimatedTimings, exactTimings, verseAt, type VerseTimings } from './timing';

export interface SurahTrack {
  kind: 'surah';
  surah: number;
  recitation: Recitation;
  url: string;
}
export interface RadioStation {
  id: string;
  name: string;
  urls: string[];
}
export interface RadioTrack extends RadioStation {
  kind: 'radio';
}
export type Track = SurahTrack | RadioTrack;
export type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type RepeatMode = 'off' | 'surah' | 'ayah';

const audio = typeof Audio !== 'undefined' ? new Audio() : ({} as HTMLAudioElement);
audio.preload = 'metadata';

export const track = signal<Track | null>(null);
export const status = signal<Status>('idle');
export const time = signal(0);
export const duration = signal(0);
export const buffered = signal(0);
export const rate = persisted<number>('player:rate', 1);
export const repeat = signal<RepeatMode>('off');
/** Hifz: repeat one ayah `left` more times. */
export const ayahLoop = signal<{ ayah: number; left: number; total: number } | null>(null);
export const timings = signal<VerseTimings | null>(null);
export const sleepAt = signal<number | null>(null);
export const sleepEndOfSurah = signal(false);
export const errorText = signal('');
export const lastSession = persisted<null | { surah: number; recitation: number; time: number; at: number }>(
  'player:last',
  null,
);
export const fullPlayerOpen = signal(false);

export const isPlaying = computed(() => status.value === 'playing' || status.value === 'loading');
export const isRadio = computed(() => track.value?.kind === 'radio');

/** 1-based ayah being recited now (0 = intro / unknown). */
export const currentAyah = computed(() => {
  const t = timings.value;
  if (!t || track.value?.kind !== 'surah') return 0;
  return verseAt(t, time.value) + 1;
});

let pendingSeek: number | null = null;
let loadToken = 0;
let retried = false;

// ── Surahs ────────────────────────────────────────────────────────────────

export async function playSurah(
  surah: number,
  opts: { ayah?: number; recitationId?: number; at?: number; autoplay?: boolean } = {},
): Promise<void> {
  const token = ++loadToken;
  status.value = 'loading';
  errorText.value = '';
  try {
    await loadRecitations();
  } catch {
    if (token !== loadToken) return;
    status.value = 'error';
    errorText.value = 'تعذر تحميل قائمة القراء. تأكد من الاتصال بالإنترنت.';
    return;
  }
  if (token !== loadToken) return;
  const rec = findRecitation(opts.recitationId ?? prefs.value.reciter) ?? findRecitation(118);
  if (!rec) {
    status.value = 'error';
    return;
  }
  if (!rec.surahs.has(surah)) {
    status.value = track.value ? (audio.paused ? 'paused' : 'playing') : 'idle';
    toast(`${rec.name} لم يسجّل سورة ${chapter(surah).ar} في هذه الرواية`);
    return;
  }
  const url = surahUrl(rec, surah);
  retried = false;
  batch(() => {
    track.value = { kind: 'surah', surah, recitation: rec, url };
    timings.value = null;
    time.value = opts.at ?? 0;
    duration.value = 0;
    ayahLoop.value = null;
    if (repeat.value === 'ayah') repeat.value = 'off';
  });
  pendingSeek = opts.at ?? null;
  audio.src = url;
  audio.playbackRate = rate.value;
  updateMediaSession();
  void loadTimings(rec, surah, token, opts.ayah);
  if (opts.autoplay === false) {
    status.value = 'paused';
    audio.load();
    return;
  }
  await startPlayback();
}

async function loadTimings(rec: Recitation, surah: number, token: number, startAyah?: number) {
  let t = rec.timed ? await exactTimings(rec.id, surah) : null;
  if (token !== loadToken) return;
  if (!t) {
    const dur = await waitForDuration();
    if (token !== loadToken || !dur) return;
    t = await estimatedTimings(surah, dur);
    if (token !== loadToken) return;
  }
  timings.value = t;
  if (startAyah && startAyah > 1) seekToAyah(startAyah);
}

function waitForDuration(): Promise<number> {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve(audio.duration);
  return new Promise((resolve) => {
    const done = () => {
      audio.removeEventListener('loadedmetadata', done);
      audio.removeEventListener('error', fail);
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const fail = () => {
      audio.removeEventListener('loadedmetadata', done);
      resolve(0);
    };
    audio.addEventListener('loadedmetadata', done);
    audio.addEventListener('error', fail, { once: true });
  });
}

async function startPlayback() {
  try {
    await audio.play();
  } catch (err) {
    if ((err as DOMException).name === 'NotAllowedError') status.value = 'paused';
    else if ((err as DOMException).name !== 'AbortError') status.value = 'error';
  }
}

export function seekToAyah(ayah: number): void {
  const t = timings.value;
  if (!t || ayah < 1 || ayah > t.starts.length) return;
  seek(t.starts[ayah - 1]);
}

/** Repeat one ayah `times` times (Infinity = until stopped). */
export function loopAyah(ayah: number, times: number): void {
  if (track.value?.kind !== 'surah') return;
  repeat.value = 'ayah';
  ayahLoop.value = { ayah, left: times, total: times };
  seekToAyah(ayah);
  if (audio.paused) void startPlayback();
}

export function next(): void {
  const t = track.value;
  if (t?.kind !== 'surah') return;
  const rec = t.recitation;
  for (let s = t.surah + 1; s <= 114; s++) if (rec.surahs.has(s)) return void playSurah(s, { recitationId: rec.id });
  toast('هذه آخر سورة');
}

export function prev(): void {
  const t = track.value;
  if (t?.kind !== 'surah') return;
  if (audio.currentTime > 4) return seek(0);
  const rec = t.recitation;
  for (let s = t.surah - 1; s >= 1; s--) if (rec.surahs.has(s)) return void playSurah(s, { recitationId: rec.id });
  seek(0);
}

/** Switch reciter, keeping the surah (and roughly the ayah) the user is on. */
export function changeRecitation(id: number): void {
  const t = track.value;
  prefs.value = { ...prefs.value, reciter: id };
  if (t?.kind === 'surah') void playSurah(t.surah, { recitationId: id, ayah: currentAyah.value || undefined });
}

// ── Radio ─────────────────────────────────────────────────────────────────

let radioTimer: ReturnType<typeof setTimeout> | undefined;

export function playRadio(station: RadioStation): void {
  const token = ++loadToken;
  batch(() => {
    track.value = { kind: 'radio', ...station };
    timings.value = null;
    status.value = 'loading';
    errorText.value = '';
    time.value = 0;
    duration.value = 0;
    repeat.value = 'off';
    ayahLoop.value = null;
  });
  updateMediaSession();
  const tryUrl = (i: number) => {
    if (token !== loadToken) return;
    clearTimeout(radioTimer);
    if (i >= station.urls.length) {
      status.value = 'error';
      errorText.value = 'الإذاعة لا تستجيب الآن. جرّب إذاعة أخرى.';
      return;
    }
    audio.src = station.urls[i];
    audio.playbackRate = 1;
    const onFail = () => {
      audio.removeEventListener('playing', onOk);
      tryUrl(i + 1);
    };
    const onOk = () => {
      clearTimeout(radioTimer);
      audio.removeEventListener('error', onFail);
    };
    audio.addEventListener('error', onFail, { once: true });
    audio.addEventListener('playing', onOk, { once: true });
    radioTimer = setTimeout(() => {
      if (token === loadToken && status.value === 'loading') onFail();
    }, 12_000);
    audio.play().catch((err: DOMException) => {
      if (err.name === 'NotAllowedError') {
        clearTimeout(radioTimer);
        status.value = 'paused';
      }
    });
  };
  tryUrl(0);
}

// ── Transport ─────────────────────────────────────────────────────────────

export function toggle(): void {
  if (!track.value) return;
  if (audio.paused) {
    if (status.value === 'error' && track.value.kind === 'radio') return playRadio(track.value);
    if (status.value === 'error' && track.value.kind === 'surah') {
      return void playSurah(track.value.surah, { recitationId: track.value.recitation.id, at: audio.currentTime });
    }
    void startPlayback();
  } else audio.pause();
}

export function pause(): void {
  audio.pause();
}

export function stop(): void {
  ++loadToken;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  batch(() => {
    track.value = null;
    status.value = 'idle';
    timings.value = null;
    time.value = 0;
    duration.value = 0;
    fullPlayerOpen.value = false;
  });
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

export function seek(sec: number): void {
  if (track.value?.kind === 'radio') return;
  const d = audio.duration;
  const target = Math.max(0, Number.isFinite(d) ? Math.min(sec, d - 0.25) : sec);
  if (audio.readyState < 1) {
    pendingSeek = target;
  } else {
    audio.currentTime = target;
  }
  time.value = target;
}

export function skip(delta: number): void {
  seek(audio.currentTime + delta);
}

export function setRate(r: number): void {
  rate.value = r;
  if (track.value?.kind === 'surah') audio.playbackRate = r;
}

export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

export function cycleRepeat(): void {
  const order: RepeatMode[] = ['off', 'surah'];
  const i = order.indexOf(repeat.value);
  repeat.value = order[(i + 1) % order.length];
  ayahLoop.value = null;
}

// ── Sleep timer ───────────────────────────────────────────────────────────

let sleepTimer: ReturnType<typeof setTimeout> | undefined;

export function setSleep(minutes: number | 'end' | null): void {
  clearTimeout(sleepTimer);
  sleepEndOfSurah.value = minutes === 'end';
  if (typeof minutes === 'number' && minutes > 0) {
    sleepAt.value = Date.now() + minutes * 60_000;
    sleepTimer = setTimeout(fadeOutAndPause, minutes * 60_000);
  } else {
    sleepAt.value = null;
  }
}

function fadeOutAndPause() {
  sleepAt.value = null;
  const start = audio.volume;
  let step = 0;
  const id = setInterval(() => {
    step++;
    audio.volume = Math.max(0, start * (1 - step / 20));
    if (step >= 20) {
      clearInterval(id);
      audio.pause();
      audio.volume = start;
    }
  }, 200);
}

// ── Element events ────────────────────────────────────────────────────────

let listenAcc = 0;
let lastTick = 0;

function flushListen() {
  if (listenAcc >= 1) {
    addListenSeconds(Math.round(listenAcc));
    listenAcc = 0;
  }
}

function saveSession() {
  const t = track.value;
  if (t?.kind !== 'surah') return;
  lastSession.value = { surah: t.surah, recitation: t.recitation.id, time: audio.currentTime, at: Date.now() };
}

if (typeof window !== 'undefined') {
  audio.addEventListener('playing', () => {
    status.value = 'playing';
    lastTick = audio.currentTime;
  });
  audio.addEventListener('pause', () => {
    if (status.value !== 'error' && track.value) status.value = 'paused';
    flushListen();
    saveSession();
  });
  audio.addEventListener('waiting', () => {
    if (!audio.paused) status.value = 'loading';
  });
  audio.addEventListener('loadedmetadata', () => {
    duration.value = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.playbackRate = track.value?.kind === 'surah' ? rate.value : 1;
    if (pendingSeek != null) {
      audio.currentTime = pendingSeek;
      pendingSeek = null;
    }
    updatePositionState();
  });
  audio.addEventListener('progress', () => {
    try {
      const b = audio.buffered;
      buffered.value = b.length ? b.end(b.length - 1) : 0;
    } catch {
      /* ignore */
    }
  });
  audio.addEventListener('timeupdate', () => {
    const now = audio.currentTime;
    time.value = now;
    if (track.value?.kind !== 'surah') return;
    const delta = now - lastTick;
    if (!audio.paused && delta > 0 && delta < 2) {
      listenAcc += delta / (audio.playbackRate || 1);
      if (listenAcc >= 30) flushListen();
    }
    lastTick = now;
    // Hifz ayah loop
    const loop = ayahLoop.value;
    const t = timings.value;
    if (repeat.value === 'ayah' && loop && t) {
      const end = t.ends[loop.ayah - 1];
      if (now >= end - 0.15) {
        if (loop.left > 1) {
          ayahLoop.value = { ...loop, left: loop.left - 1 };
          audio.currentTime = t.starts[loop.ayah - 1];
        } else {
          ayahLoop.value = null;
          repeat.value = 'off';
        }
      }
    }
    if (Math.floor(now) % 15 === 0) saveSession();
  });
  audio.addEventListener('ratechange', updatePositionState);
  audio.addEventListener('seeked', updatePositionState);
  audio.addEventListener('ended', () => {
    flushListen();
    const t = track.value;
    if (t?.kind !== 'surah') return;
    bumpStat('surahsListened');
    lastSession.value = null;
    if (repeat.value === 'surah') {
      audio.currentTime = 0;
      void startPlayback();
    } else if (sleepEndOfSurah.value) {
      sleepEndOfSurah.value = false;
      status.value = 'paused';
    } else if (prefs.value.autoplay && t.surah < 114) {
      next();
    } else {
      status.value = 'paused';
    }
  });
  audio.addEventListener('error', () => {
    const t = track.value;
    if (!t || t.kind === 'radio' || !audio.src) return;
    if (!retried && navigator.onLine) {
      retried = true;
      const at = audio.currentTime;
      pendingSeek = at;
      audio.load();
      void startPlayback();
      return;
    }
    status.value = 'error';
    errorText.value = navigator.onLine
      ? 'تعذر تشغيل التلاوة. حاول مرة أخرى.'
      : 'لا يوجد اتصال بالإنترنت. السور المحمّلة فقط تعمل بدون إنترنت.';
  });
  window.addEventListener('pagehide', () => {
    flushListen();
    saveSession();
  });
}

// ── Media Session (lock screen / headphones / car) ────────────────────────

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const t = track.value;
  if (!t) return;
  const title = t.kind === 'surah' ? `سورة ${chapter(t.surah).ar}` : t.name;
  const artist = t.kind === 'surah' ? t.recitation.name : 'بث مباشر';
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
    album: 'تراتيل',
    artwork: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
}

function updatePositionState() {
  if (!('mediaSession' in navigator) || track.value?.kind !== 'surah') return;
  const d = audio.duration;
  if (!Number.isFinite(d) || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: d,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime, d),
    });
  } catch {
    /* ignore */
  }
}

if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, h);
    } catch {
      /* unsupported action */
    }
  };
  set('play', () => void startPlayback());
  set('pause', () => audio.pause());
  set('nexttrack', next);
  set('previoustrack', prev);
  set('seekbackward', (d) => skip(-(d.seekOffset || 10)));
  set('seekforward', (d) => skip(d.seekOffset || 10));
  set('seekto', (d) => d.seekTime != null && seek(d.seekTime));
  set('stop', stop);
  effect(() => {
    ms.playbackState = status.value === 'playing' ? 'playing' : status.value === 'paused' ? 'paused' : 'none';
  });
}

/** Resume the last listening session (from Home). */
export function resumeLast(): void {
  const s = lastSession.value;
  if (!s) return;
  void playSurah(s.surah, { recitationId: s.recitation, at: Math.max(0, s.time - 2) });
}
