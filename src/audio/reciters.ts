import { signal } from '@preact/signals';
import { normalizeArabic } from '../lib/arabic';
import { fetchJSON } from '../lib/net';
import { persisted } from '../lib/storage';

const API = 'https://www.mp3quran.net/api/v3';

/** One playable recitation = a reciter + a moshaf (riwaya / style). */
export interface Recitation {
  /** mp3quran moshaf id (also the `read` id of the verse-timing API). */
  id: number;
  reciterId: number;
  name: string;
  /** e.g. "حفص عن عاصم - مرتل" */
  style: string;
  server: string;
  surahs: Set<number>;
  /** Exact per-verse timings are available. */
  timed: boolean;
  search: string;
}

interface ApiReciter {
  id: number;
  name: string;
  moshaf: { id: number; name: string; server: string; surah_list: string }[];
}

export const recitations = signal<Recitation[]>([]);
export const recitationsError = signal(false);
export const favoriteReciters = persisted<number[]>('reciters:fav', []);

let loading: Promise<Recitation[]> | null = null;

export function loadRecitations(): Promise<Recitation[]> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const [{ reciters }, timed] = await Promise.all([
        fetchJSON<{ reciters: ApiReciter[] }>(`${API}/reciters?language=ar`),
        fetchJSON<{ id: number }[]>(`${API}/ayat_timing/reads`).catch(() => [] as { id: number }[]),
      ]);
      const timedIds = new Set(timed.map((r) => r.id));
      const list: Recitation[] = [];
      for (const r of reciters) {
        for (const m of r.moshaf) {
          const server = m.server.endsWith('/') ? m.server : `${m.server}/`;
          list.push({
            id: m.id,
            reciterId: r.id,
            name: r.name.trim(),
            style: m.name.trim(),
            server: server.replace(/^http:/, 'https:'),
            surahs: new Set(m.surah_list.split(',').map(Number).filter(Boolean)),
            timed: timedIds.has(m.id),
            search: normalizeArabic(`${r.name} ${m.name}`),
          });
        }
      }
      list.sort((a, b) => a.name.localeCompare(b.name, 'ar') || a.style.localeCompare(b.style, 'ar'));
      recitations.value = list;
      recitationsError.value = false;
      return list;
    } catch (err) {
      loading = null;
      recitationsError.value = true;
      throw err;
    }
  })();
  return loading;
}

export function findRecitation(id: number): Recitation | undefined {
  return recitations.value.find((r) => r.id === id);
}

export function surahUrl(r: Recitation, surah: number): string {
  return `${r.server}${String(surah).padStart(3, '0')}.mp3`;
}

export function toggleFavorite(id: number): void {
  const f = favoriteReciters.value;
  favoriteReciters.value = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f];
}

/** Short style label: "مرتل" / "مجود" + riwaya when it isn't Hafs. */
export function styleLabel(r: Recitation): string {
  return r.style.replace('حفص عن عاصم - ', '').replace('المصحف ', '');
}
