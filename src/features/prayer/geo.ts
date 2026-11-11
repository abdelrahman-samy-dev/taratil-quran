/** Location lookups: device GPS, reverse label and city search (all key-less, CORS-enabled). */
import { fetchJSON } from '../../lib/net';
import { deviceTimeZone, isValidTimeZone, methodForCountry } from './calc';

export interface PrayerLocation {
  name: string;
  country?: string;
  /** ISO 3166-1 alpha-2, drives the default calculation method. */
  countryCode?: string;
  /** Governorate / state, for disambiguation. */
  admin1?: string;
  lat: number;
  lon: number;
  /** IANA time zone of the place. */
  tz: string;
  source?: 'gps' | 'search' | 'legacy';
}

export interface CityResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  population?: number;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function cityToLocation(r: CityResult, source: PrayerLocation['source'] = 'search'): PrayerLocation {
  return {
    name: r.name,
    country: r.country,
    countryCode: r.country_code,
    admin1: r.admin1,
    lat: round4(r.latitude),
    lon: round4(r.longitude),
    tz: isValidTimeZone(r.timezone) ? r.timezone : deviceTimeZone(),
    source,
  };
}

function searchUrl(q: string, lang: string) {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${lang}`;
}

/**
 * Open-Meteo city search. Arabic names with the article «ال» are also searched
 * without it (the index often stores «منصورة» for المنصورة), then results are
 * merged and ranked by population so big cities come first.
 */
export async function searchCities(query: string, signal?: AbortSignal, lang = 'ar'): Promise<CityResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const variants = [q];
  if (/^ال[ء-ي]{2,}/.test(q)) variants.push(q.slice(2));
  const settled = await Promise.allSettled(
    variants.map((v) => fetchJSON<{ results?: CityResult[] }>(searchUrl(v, lang), { timeout: 8000, retries: 1, signal })),
  );
  if (settled.every((s) => s.status === 'rejected')) throw (settled[0] as PromiseRejectedResult).reason;
  const seen = new Set<number>();
  const merged: CityResult[] = [];
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const r of s.value.results ?? []) {
      if (seen.has(r.id) || typeof r.latitude !== 'number') continue;
      seen.add(r.id);
      merged.push(r);
    }
  }
  // Stable sort: known population first (desc), unknown keep the API order.
  return merged
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.population ?? 0) - (a.r.population ?? 0) || a.i - b.i)
    .slice(0, 8)
    .map((x) => x.r);
}

export type GeoErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
  constructor(public code: GeoErrorCode) {
    super(code);
  }
}

export const GEO_MESSAGES: Record<GeoErrorCode, string> = {
  unsupported: 'المتصفح لا يدعم تحديد الموقع. ابحث عن مدينتك بالاسم.',
  denied: 'لم يُسمح بالوصول إلى الموقع. يمكنك السماح به من إعدادات المتصفح أو البحث عن مدينتك.',
  unavailable: 'تعذّر تحديد موقعك الآن. تأكد من تشغيل خدمة الموقع أو ابحث عن مدينتك.',
  timeout: 'استغرق تحديد الموقع وقتًا طويلًا. حاول مرة أخرى أو ابحث عن مدينتك.',
};

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject(new GeoError('unsupported'));
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) =>
        reject(new GeoError(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}

interface ReverseResult {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
}

/** Device position + a best-effort Arabic place name; uses the device time zone. */
export async function locateMe(): Promise<PrayerLocation> {
  const pos = await getPosition();
  const lat = round4(pos.coords.latitude);
  const lon = round4(pos.coords.longitude);
  const tz = deviceTimeZone();
  const loc: PrayerLocation = { name: 'موقعي الحالي', lat, lon, tz, source: 'gps' };
  try {
    const r = await fetchJSON<ReverseResult>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ar`,
      { timeout: 6000, retries: 0 },
    );
    const name = r.city || r.locality || r.principalSubdivision;
    if (name) loc.name = name;
    if (r.principalSubdivision && r.principalSubdivision !== name) loc.admin1 = r.principalSubdivision;
    if (r.countryName) loc.country = r.countryName;
    if (r.countryCode) loc.countryCode = r.countryCode;
  } catch {
    // Offline or blocked: keep the generic label; the method falls back to the time zone.
  }
  if (!loc.countryCode) {
    const byTz = methodForCountry(null, tz);
    if (byTz === 'Egyptian') loc.countryCode = 'EG';
    else if (byTz === 'UmmAlQura') loc.countryCode = 'SA';
  }
  return loc;
}

/** "المنصورة، مصر" */
export function placeLabel(loc: Pick<PrayerLocation, 'name' | 'country'>): string {
  return loc.country && loc.country !== loc.name ? `${loc.name}، ${loc.country}` : loc.name;
}
