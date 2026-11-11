/**
 * Ayah of the day: a curated list of complete, self-contained ayat so the
 * daily card never shows a fragment out of context. Text comes from the
 * shipped Quran data, never from this file.
 */
export const DAILY_AYAT = [
  '2:152', '2:153', '2:186', '2:201', '2:255', '2:286', '3:8', '3:31', '3:139', '3:200',
  '4:110', '6:162', '7:56', '9:51', '12:87', '13:28', '14:7', '16:97', '17:80', '20:114',
  '21:87', '25:74', '29:69', '33:41', '39:53', '40:60', '41:30', '42:19', '49:13', '50:16',
  '59:22', '65:3', '67:2', '93:5', '94:6', '103:3', '112:1', '55:13',
] as const;

export function ayahOfTheDay(date = new Date()): string {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return DAILY_AYAT[day % DAILY_AYAT.length];
}
