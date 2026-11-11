import type { PrayerKey } from './calc';

/** Small stroke icons for each prayer time (same 24×24 style as ui/Icon). */
const G: Record<PrayerKey, string> = {
  fajr: 'M3 20h18M7.5 20a4.5 4.5 0 0 1 9 0M12 11.5v-1.5M7.2 13.4 6.1 12.3M16.8 13.4l1.1-1.1M17 3.5v3M15.5 5h3',
  sunrise: 'M2 19h20M7 19a5 5 0 0 1 10 0M12 2.5v7M9 5.5l3-3 3 3M4.6 11.6l1.4 1.4M19.4 11.6 18 13',
  dhuhr:
    'M12 4V2M12 22v-2M4.9 4.9 6.3 6.3M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
  asr: 'M3 21h18M15 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M15 1.5v1M20.5 8.5h-1M19 4.5l-.7.7M11 4.5l.7.7M6 21v-8',
  maghrib: 'M2 19h20M7 19a5 5 0 0 1 10 0M12 9.5v-7M9 6.5l3 3 3-3M4.6 11.6l1.4 1.4M19.4 11.6 18 13',
  isha: 'M20 13.6A8 8 0 1 1 10.4 4 6.2 6.2 0 0 0 20 13.6zM18 2.5v3M16.5 4h3',
};

export function PrayerGlyph({ name, size = 22 }: { name: PrayerKey; size?: number }) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={2}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={G[name]} />
    </svg>
  );
}
