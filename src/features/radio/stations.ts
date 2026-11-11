/**
 * Radio stations: a few verified national Quran radios (live) plus the
 * mp3quran.net catalogue (≈177 continuous streams: reciters, tafsir,
 * translations and assorted programmes).
 */
import { arNum, normalizeArabic } from '../../lib/arabic';
import { fetchJSON } from '../../lib/net';
import type { RadioStation } from '../../audio/player';

export type Category = 'featured' | 'reciters' | 'tafsir' | 'translations' | 'misc';

export interface Station extends RadioStation {
  category: Category;
  /** Riwaya / style, e.g. «مجوّد», «رواية ورش». */
  subtitle?: string;
  /** Live national radios only. */
  live?: { title: string; place: string; country: string };
  /** Normalised name for search. */
  key: string;
}

export const RADIOS_API = 'https://www.mp3quran.net/api/v3/radios?language=ar';

/**
 * National Quran radios. Every URL was checked to stream audio (2026-11-11);
 * extra URLs are fallbacks tried in order by the player.
 */
export const LIVE: Station[] = [
  {
    id: 'live-cairo',
    name: 'إذاعة القرآن الكريم من القاهرة',
    urls: ['https://stream.radiojar.com/8s5u5tpdtwzuv', 'https://radio.xecod.com/station/quran-cairo'],
    live: { title: 'إذاعة القرآن الكريم', place: 'من القاهرة', country: 'مصر' },
  },
  {
    id: 'live-saudi',
    name: 'إذاعة القرآن الكريم من السعودية',
    urls: [
      'https://stream.radiojar.com/0tpy1h0kxtzuv',
      'https://n0a.radiojar.com/0tpy1h0kxtzuv',
      'https://stream.radiojar.com/4wqre23fytzuv',
    ],
    live: { title: 'إذاعة القرآن الكريم', place: 'من المملكة العربية السعودية', country: 'السعودية' },
  },
  {
    id: 'live-sharjah',
    name: 'إذاعة الشارقة للقرآن الكريم',
    urls: ['https://l3.itworkscdn.net/smcquranlive/quranradiolive/icecast.audio'],
    live: { title: 'إذاعة الشارقة للقرآن الكريم', place: 'من الشارقة', country: 'الإمارات' },
  },
  {
    id: 'live-algeria',
    name: 'إذاعة القرآن الكريم الجزائرية',
    urls: ['https://webradio1.tda.dz:8001/Coran_64K.mp3'],
    live: { title: 'إذاعة القرآن الكريم', place: 'من الجزائر', country: 'الجزائر' },
  },
  {
    id: 'live-zitouna',
    name: 'إذاعة الزيتونة للقرآن الكريم',
    urls: ['https://radio.radiotunisienne.tn/radiozaitouna'],
    live: { title: 'إذاعة الزيتونة للقرآن الكريم', place: 'من تونس', country: 'تونس' },
  },
].map((s) => ({ ...s, category: 'featured' as const, key: normalizeArabic(`${s.name} ${s.live.country}`) }));

/** mp3quran streams shown under «مميزة» (by URL slug). */
const PICKS = [
  'mishary_alafasi',
  'mohammed_siddiq_alminshawi_mojawwad',
  'mahmoud_khalil_alhussary',
  'abdulbasit_abdulsamad_mojawwad',
  'maher',
  'abdulrahman_alsudaes',
  'saud_alshuraim',
  'saad_alghamdi',
  'yasser_aldosari',
  'ali_alhuthaifi',
  'nasser_alqatami',
  'fares_abbad',
  'sakeenah',
  'roqiah',
  'athkar_sabah',
  'athkar_masa',
  'Surah_Al-Mulk',
  'albaqarah',
];

/** Non-reciter programmes in the mp3quran list. */
const MISC_SLUGS = new Set([
  'mix',
  'salma',
  'eid',
  'fatwa',
  'roqiah',
  'albaqarah',
  'tarateel',
  'sakeenah',
  'sahabah',
  'athkar_sabah',
  'athkar_masa',
  'fi_zilal_alsiyra',
  'almukhtasar_fi_alsiyra',
  'alaikhtiarat_alfiqhayh_bin_baz',
  'surah_al-mulk',
  'ramadan',
  'saheh-muslim',
  'saheh-bokharee',
  'alanbiya',
  'riyad',
  'shmaeel',
]);

/** Name words (normalised) that mark a programme rather than a reciter. */
const MISC_WORDS = [
  'متنوعه',
  'تلاوات',
  'تكبيرات',
  'فتاوي',
  'رقيه',
  'سوره',
  'تراتيل',
  'ايات',
  'اذكار',
  'سيره',
  'كتاب',
  'فضل',
  'صحيح',
  'قصص',
  'رياض',
  'شمائل',
  'صحابه',
  'اذاعه القران',
].map(normalizeArabic);

export function slugOf(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    return path.slice(path.lastIndexOf('/') + 1);
  } catch {
    return '';
  }
}

export function categorize(name: string, url: string): Exclude<Category, 'featured'> {
  const slug = slugOf(url).toLowerCase();
  const n = normalizeArabic(name);
  if (slug.startsWith('translation') || n.includes('ترجمه')) return 'translations';
  if (n.includes('تفسير') || /tafs|tafseer|tabri/.test(slug)) return 'tafsir';
  if (MISC_SLUGS.has(slug) || MISC_WORDS.some((w) => n.includes(w))) return 'misc';
  return 'reciters';
}

/** Riwaya / style, read only from the stream's slug where it is explicit. */
const STYLES: [RegExp, string][] = [
  [/_mojawwad$/, 'مجوّد'],
  [/_warsh$/, 'رواية ورش'],
  [/_qalon$/, 'رواية قالون'],
  [/_albizi$/, 'رواية البزي'],
  [/_aldori_an_abi_amr$/, 'رواية الدوري عن أبي عمرو'],
  [/_aldorai$/, 'رواية الدوري'],
  [/_ibn_thakwan_an_ibn_amr$/, 'رواية ابن ذكوان عن ابن عامر'],
  [/_khalaf$/, 'رواية خلف'],
  [/_assosi$/, 'رواية السوسي'],
  [/_alasbahani$/, 'رواية الأصبهاني'],
];

export function styleOf(url: string): string | undefined {
  const slug = slugOf(url);
  return STYLES.find(([re]) => re.test(slug))?.[1];
}

/** Tidy names from the API: stray dashes/asterisks, a typo, honorific prefix. */
export function cleanName(name: string): string {
  return name
    .replace(/^[\s*\-–]+|[\s*\-–]+$/g, '')
    .replace(/^أذاعة/, 'إذاعة')
    .replace(/^(?:ال)?شيخ\s+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\d+/g, (d) => arNum(d))
    .trim();
}

/**
 * Every stream URL to try, in order: https first, and the qurango.net mirror
 * for backup.qurango.net (and vice versa).
 */
export function mirrorUrls(url: string): string[] {
  const u = url.trim().replace(/^http:\/\//, 'https://');
  const out = [u];
  if (/^https:\/\/backup\.qurango\.net\//.test(u)) out.push(u.replace('://backup.qurango.net/', '://qurango.net/'));
  else if (/^https:\/\/qurango\.net\//.test(u)) out.push(u.replace('://qurango.net/', '://backup.qurango.net/'));
  return out;
}

interface ApiRadio {
  id: number;
  name: string;
  url: string;
}

const liveUrls = new Set(LIVE.flatMap((s) => s.urls.map((u) => u.replace(/^https?:\/\//, ''))));

export function fromApi(radios: ApiRadio[]): Station[] {
  const out: Station[] = [];
  const seen = new Set<string>();
  for (const r of radios) {
    if (!r?.url || !r.name) continue;
    const bare = r.url.trim().replace(/^https?:\/\//, '');
    if (liveUrls.has(bare) || seen.has(bare)) continue; // already in the live list / duplicate
    seen.add(bare);
    const name = cleanName(r.name);
    const subtitle = styleOf(r.url);
    out.push({
      id: `mp3q-${r.id}`,
      name: subtitle ? `${name} (${subtitle})` : name,
      urls: mirrorUrls(r.url),
      category: categorize(name, r.url),
      subtitle,
      key: normalizeArabic(`${name} ${subtitle ?? ''}`),
    });
  }
  return out;
}

/** Stations picked for the «مميزة» tab, in PICKS order. */
export function picks(stations: Station[]): Station[] {
  const bySlug = new Map(stations.map((s) => [slugOf(s.urls[0]).toLowerCase(), s]));
  return PICKS.map((p) => bySlug.get(p.toLowerCase())).filter((s): s is Station => !!s);
}

export async function loadStations(): Promise<Station[]> {
  const data = await fetchJSON<{ radios: ApiRadio[] }>(RADIOS_API);
  return fromApi(data.radios ?? []);
}

/** Display name without the riwaya suffix we add for the player. */
export function baseName(s: Station): string {
  return s.subtitle ? s.name.slice(0, -(s.subtitle.length + 3)) : s.name;
}

export function filterStations(list: Station[], query: string): Station[] {
  const q = normalizeArabic(query);
  if (!q) return list;
  const terms = q.split(' ');
  return list.filter((s) => terms.every((t) => s.key.includes(t)));
}
