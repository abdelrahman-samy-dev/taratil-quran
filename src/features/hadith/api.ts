/** fawazahmed0/hadith-api on jsDelivr (pinned to major version 1). The service worker caches it. */
export const HADITH_API = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';

/** Arabic edition with diacritics, e.g. ara-bukhari. */
export function editionUrl(slug: string): string {
  return `${HADITH_API}/editions/ara-${slug}.min.json`;
}

/** Same cache name as src/sw.ts uses for hadith-api responses. */
export const HADITH_CACHE = 'taratil-hadith-v1';

export interface RawGrade {
  name: string;
  grade: string;
}

export interface RawHadith {
  hadithnumber: number;
  arabicnumber?: number | string;
  text: string;
  grades?: RawGrade[];
  reference?: { book: number; hadith: number };
}

export interface RawEdition {
  metadata: {
    name: string;
    sections: Record<string, string>;
    section_details?: Record<string, unknown>;
  };
  hadiths: RawHadith[];
}
