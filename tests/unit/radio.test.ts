import { describe, expect, it } from 'vitest';
import {
  LIVE,
  baseName,
  categorize,
  cleanName,
  filterStations,
  fromApi,
  mirrorUrls,
  picks,
  slugOf,
  styleOf,
} from '../../src/features/radio/stations';

const Q = 'https://backup.qurango.net/radio/';

describe('categorisation', () => {
  it('puts reciters under القراء', () => {
    expect(categorize('مشاري العفاسي', `${Q}mishary_alafasi`)).toBe('reciters');
    expect(categorize('محمود خليل الحصري', `${Q}mahmoud_khalil_alhussary_warsh`)).toBe('reciters');
    expect(categorize('إذاعة محمد أبوسنينة', `${Q}sneineh`)).toBe('reciters');
  });

  it('detects tafsir and translations', () => {
    expect(categorize('تفسير القران الكريم', `${Q}tafseer`)).toBe('tafsir');
    expect(categorize('المختصر في تفسير القرآن الكريم', `${Q}mukhtasartafsir`)).toBe('tafsir');
    expect(categorize('ترجمة معاني القرآن باللغة الفرنسية', `${Q}translation_quran_french`)).toBe('translations');
    expect(categorize('Hausa', `${Q}Translation_Quran_Hausa`)).toBe('translations');
  });

  it('puts programmes under متنوعة', () => {
    expect(categorize('أذكار الصباح', `${Q}athkar_sabah`)).toBe('misc');
    expect(categorize('الرقية الشرعية', `${Q}roqiah`)).toBe('misc');
    expect(categorize('صحيح البخاري', `${Q}saheh-bokharee`)).toBe('misc');
    expect(categorize('سورة الملك', `${Q}Surah_Al-Mulk`)).toBe('misc');
    expect(categorize('إذاعة القرآن الكريم - السعودية', 'https://stream.radiojar.com/abc')).toBe('misc');
  });
});

describe('mirror URLs', () => {
  it('adds qurango.net as a mirror for backup.qurango.net', () => {
    expect(mirrorUrls(`${Q}maher`)).toEqual([`${Q}maher`, 'https://qurango.net/radio/maher']);
  });

  it('adds the backup host for qurango.net and upgrades http', () => {
    expect(mirrorUrls('http://qurango.net/radio/maher')).toEqual([
      'https://qurango.net/radio/maher',
      'https://backup.qurango.net/radio/maher',
    ]);
  });

  it('leaves other hosts alone', () => {
    expect(mirrorUrls('https://stream.radiojar.com/8s5u5tpdtwzuv')).toEqual(['https://stream.radiojar.com/8s5u5tpdtwzuv']);
  });
});

describe('names and styles', () => {
  it('cleans API names', () => {
    expect(cleanName('سورة البقرة - لعدد من القراء---')).toBe('سورة البقرة - لعدد من القراء');
    expect(cleanName('***قصص الأنبياء***')).toBe('قصص الأنبياء');
    expect(cleanName('شيخ أبو بكر الشاطري')).toBe('أبو بكر الشاطري');
    expect(cleanName('أذاعة محمد أبوسنينة')).toBe('إذاعة محمد أبوسنينة');
    expect(cleanName('في ظلال السيرة النبوية - 400 حلقة')).toBe('في ظلال السيرة النبوية - ٤٠٠ حلقة');
  });

  it('reads the riwaya from the slug only when explicit', () => {
    expect(styleOf(`${Q}abdulbasit_abdulsamad_mojawwad`)).toBe('مجوّد');
    expect(styleOf(`${Q}abdulbasit_abdulsamad_warsh`)).toBe('رواية ورش');
    expect(styleOf(`${Q}muftah_alsaltany_aldori_an_abi_amr`)).toBe('رواية الدوري عن أبي عمرو');
    expect(styleOf(`${Q}abdulbasit_abdulsamad`)).toBeUndefined();
    expect(slugOf(`${Q}maher/`)).toBe('maher');
  });
});

describe('catalogue', () => {
  const api = [
    { id: 32, name: 'عبدالباسط عبدالصمد', url: `${Q}abdulbasit_abdulsamad` },
    { id: 30, name: 'عبدالباسط عبدالصمد', url: `${Q}abdulbasit_abdulsamad_mojawwad` },
    { id: 79, name: 'مشاري العفاسي', url: `${Q}mishary_alafasi` },
    { id: 79, name: 'مشاري العفاسي', url: `${Q}mishary_alafasi` }, // duplicate
    { id: 116, name: 'تفسير القران الكريم--', url: `${Q}tafseer` },
    { id: 109082, name: 'إذاعة القرآن الكريم - السعودية', url: 'https://stream.radiojar.com/0tpy1h0kxtzuv' },
  ];
  const list = fromApi(api);

  it('drops duplicates and stations already in the live list', () => {
    expect(list.map((s) => s.id)).toEqual(['mp3q-32', 'mp3q-30', 'mp3q-79', 'mp3q-116']);
  });

  it('keeps riwaya in the player name but not in the display name', () => {
    const m = list.find((s) => s.id === 'mp3q-30')!;
    expect(m.name).toBe('عبدالباسط عبدالصمد (مجوّد)');
    expect(baseName(m)).toBe('عبدالباسط عبدالصمد');
    expect(m.urls).toHaveLength(2);
  });

  it('searches without diacritics or hamza differences', () => {
    expect(filterStations(list, 'العفاسى').map((s) => s.id)).toEqual(['mp3q-79']);
    // The API writes «عبدالباسط» as one word; each typed word still matches as a substring.
    expect(filterStations(list, 'عبد الباسط').map((s) => s.id)).toEqual(['mp3q-32', 'mp3q-30']);
    expect(filterStations(list, 'عبدالباسط مجود').map((s) => s.id)).toEqual(['mp3q-30']);
    expect(filterStations(list, '')).toBe(list);
  });

  it('picks featured stations that exist', () => {
    expect(picks(list).map((s) => s.id)).toEqual(['mp3q-79', 'mp3q-30']);
  });

  it('has live stations with https URLs and a country', () => {
    expect(LIVE.length).toBeGreaterThanOrEqual(3);
    for (const s of LIVE) {
      expect(s.urls.length).toBeGreaterThan(0);
      expect(s.urls.every((u) => u.startsWith('https://'))).toBe(true);
      expect(s.live?.country).toBeTruthy();
      expect(s.category).toBe('featured');
    }
  });
});
