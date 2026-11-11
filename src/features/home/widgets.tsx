import { NextPrayerWidget } from '../prayer/NextPrayerWidget';

/** Home widgets contributed by other features (prayer, azkar, hadith). */
export function HomeWidgets() {
  return (
    <>
      <NextPrayerWidget class="home-prayer" />
    </>
  );
}
