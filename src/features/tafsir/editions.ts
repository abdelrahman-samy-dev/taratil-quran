import { fetchJSON } from '../../lib/net';

export interface Edition {
  /** alquran.cloud edition identifier. */
  id: string;
  name: string;
  /** Short label for the toolbar. */
  short: string;
  desc: string;
  /** Large per-ayah texts: render fewer ayat per batch. */
  long?: boolean;
}

/**
 * Arabic tafsir editions served by alquran.cloud (all verified to respond).
 * Note: the source's `ar.miqbas` edition is labelled "تنوير المقباس" upstream,
 * but its text is Ibn Ashur's «التحرير والتنوير»; it is named here by its real content.
 */
export const EDITIONS: Edition[] = [
  { id: 'ar.muyassar', name: 'التفسير الميسر', short: 'الميسر', desc: 'مجمع الملك فهد · مختصر وواضح' },
  { id: 'ar.jalalayn', name: 'تفسير الجلالين', short: 'الجلالين', desc: 'المحلي والسيوطي · موجز' },
  { id: 'ar.waseet', name: 'التفسير الوسيط', short: 'الوسيط', desc: 'مفصّل', long: true },
  { id: 'ar.baghawi', name: 'تفسير البغوي', short: 'البغوي', desc: 'معالم التنزيل · مفصّل', long: true },
  { id: 'ar.qurtubi', name: 'تفسير القرطبي', short: 'القرطبي', desc: 'الجامع لأحكام القرآن · مطوّل', long: true },
  { id: 'ar.miqbas', name: 'التحرير والتنوير', short: 'ابن عاشور', desc: 'الطاهر ابن عاشور · مطوّل', long: true },
];

export function resolveEdition(id: string | undefined): Edition {
  return EDITIONS.find((e) => e.id === id) ?? EDITIONS[0];
}

interface ApiSurah {
  data?: { ayahs?: { numberInSurah: number; text?: string }[] };
}

const LRU_SIZE = 6;
const cache = new Map<string, string[]>();

/**
 * Tafsir of a whole surah, index 0 = ayah 1. Kept in a small LRU instead of
 * fetchJSON's session memo: a single Qurtubi surah can be several MB.
 * Offline persistence is the service worker's job (api.alquran.cloud is cache-first).
 */
export async function loadTafsir(surah: number, edition: string): Promise<string[]> {
  const key = `${edition}/${surah}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const res = await fetchJSON<ApiSurah>(`https://api.alquran.cloud/v1/surah/${surah}/${edition}`, {
    memo: false,
    retries: 1,
    timeout: 45_000,
  });
  const ayahs = res?.data?.ayahs;
  if (!Array.isArray(ayahs) || !ayahs.length) throw new Error('Unexpected tafsir response');
  const out: string[] = [];
  for (const a of ayahs) out[a.numberInSurah - 1] = (a.text ?? '').trim();
  for (let i = 0; i < out.length; i++) out[i] ??= '';
  cache.set(key, out);
  if (cache.size > LRU_SIZE) cache.delete(cache.keys().next().value as string);
  return out;
}
