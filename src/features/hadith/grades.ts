/**
 * Hadith grades come from the API in English transliteration ("Sahih",
 * "Isnaad Hasan", "Sahih Bukhari (1023) Sahih Muslim (894)"…). They are
 * translated term by term into the standard Arabic terminology. Anything we
 * cannot translate fully is dropped rather than shown half in English.
 */
import { arNum } from '../../lib/arabic';

const GRADERS: Record<string, string> = {
  'Al-Albani': 'الألباني',
  'Zubair Ali Zai': 'زبير علي زئي',
  'Shuaib Al Arnaut': 'شعيب الأرناؤوط',
  'Muhammad Muhyi Al-Din Abdul Hamid': 'محمد محيي الدين عبد الحميد',
  'Ahmad Muhammad Shakir': 'أحمد محمد شاكر',
  'Bashar Awad Maarouf': 'بشار عواد معروف',
  'Abu Ghuddah': 'عبد الفتاح أبو غدة',
  'Muhammad Fouad Abd al-Baqi': 'محمد فؤاد عبد الباقي',
  'Salim al-Hilali': 'سليم الهلالي',
};

export function graderName(name: string): string | null {
  return GRADERS[name.trim()] ?? null;
}

/** Single-word terms. */
const WORDS: Record<string, string> = {
  sahih: 'صحيح',
  hasan: 'حسن',
  daif: 'ضعيف',
  lighairihi: 'لغيره',
  mauquf: 'موقوف',
  muquf: 'موقوف',
  maqtu: 'مقطوع',
  mursal: 'مرسل',
  shadh: 'شاذ',
  munkar: 'منكر',
  mawdu: 'موضوع',
  batil: 'باطل',
  malool: 'معلول',
  mutawatir: 'متواتر',
  matn: 'المتن',
};

type Tok = { kind: 'word'; w: string } | { kind: 'ref'; nums: string | null } | { kind: 'sep' };

function tokenize(grade: string): Tok[] {
  const out: Tok[] = [];
  const re = /\(([^)]*)\)|[A-Za-z']+|[-–,،]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(grade))) {
    if (m[1] !== undefined) {
      // Book numbers: "1991، 1992", "715 After 1928", "1891 Mukhtasar".
      const inner = m[1]
        .replace(/\bAfter\b/gi, 'بعد')
        .replace(/\bMukhtasar\b/gi, 'مختصرًا')
        .replace(/\s*[,،]\s*/g, '، ')
        .replace(/\s+/g, ' ')
        .trim();
      // Unknown wording inside the reference: keep the book, drop the numbers.
      out.push({ kind: 'ref', nums: inner && !/[A-Za-z]/.test(inner) ? arNum(inner) : null });
    } else if (/^[A-Za-z']+$/.test(m[0])) {
      out.push({ kind: 'word', w: m[0].toLowerCase() });
    } else {
      out.push({ kind: 'sep' });
    }
  }
  return out;
}

/**
 * "Isnaad Hasan" → «إسناده حسن», "Sahih Isnaad" → «صحيح الإسناد»,
 * "Sahih - Agreed Upon" → «صحيح، متفق عليه», "Sahih Bukhari (98) Sahih Muslim (884)" →
 * «صحيح البخاري (٩٨)، صحيح مسلم (٨٨٤)». Returns null when a term is unknown.
 */
export function translateGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;
  const toks = tokenize(grade.trim());
  if (!toks.length) return null;
  const parts: string[] = []; // comma-separated phrases
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) parts.push(cur.join(' '));
    cur = [];
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === 'sep') {
      flush();
      continue;
    }
    if (t.kind === 'ref') {
      if (!cur.length) return null;
      if (t.nums) cur.push(`(${t.nums})`);
      flush();
      continue;
    }
    const w = t.w;
    const nextW = toks[i + 1]?.kind === 'word' ? (toks[i + 1] as { w: string }).w : '';
    const afterNext = toks[i + 2]?.kind === 'word' ? (toks[i + 2] as { w: string }).w : '';
    if (w === 'sahih' && (nextW === 'bukhari' || nextW === 'muslim') && afterNext !== 'and') {
      flush();
      cur.push(nextW === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم');
      i++;
      continue;
    }
    if (w === 'bukhari' || w === 'muslim') {
      // "Bukhari And Muslim" (where it was reported)
      if (w === 'bukhari' && nextW === 'and' && (toks[i + 2] as { w?: string })?.w === 'muslim') {
        flush();
        cur.push('رواه البخاري ومسلم');
        i += 2;
        continue;
      }
      flush();
      cur.push(w === 'bukhari' ? 'رواه البخاري' : 'رواه مسلم');
      continue;
    }
    if (w === 'agreed' && nextW === 'upon') {
      flush();
      cur.push('متفق عليه');
      i++;
      continue;
    }
    if (w === 'very' && nextW === 'daif') {
      cur.push('ضعيف جدًا');
      i++;
      continue;
    }
    if (w === 'isnaad' || w === 'sanad') {
      // Leading: "Isnaad Sahih" = إسناده صحيح; trailing: "Sahih Isnaad" = صحيح الإسناد
      const word = w === 'isnaad' ? (cur.length ? 'الإسناد' : 'إسناده') : cur.length ? 'السند' : 'سنده';
      cur.push(word);
      continue;
    }
    if (w === 'hadith') {
      if (!cur.length) return null;
      cur.unshift('حديث');
      continue;
    }
    const ar = WORDS[w];
    if (!ar) return null;
    cur.push(ar);
  }
  flush();
  const text = parts.join('، ').trim();
  return text || null;
}

export type GradeTone = 'sahih' | 'hasan' | 'daif' | 'other';

/** Colour family for a translated grade. Weak/fabricated wins over sound. */
export function gradeTone(grade: string): GradeTone {
  const g = grade.toLowerCase();
  if (/daif|munkar|mawdu|batil|shadh|malool/.test(g)) return 'daif';
  if (/sahih|agreed|mutawatir/.test(g)) return 'sahih';
  if (/hasan/.test(g)) return 'hasan';
  return 'other';
}

export interface DisplayGrade {
  grade: string;
  grader: string | null;
  tone: GradeTone;
}

/** Translate a hadith's grades, skipping empty ("-") and untranslatable ones. */
export function displayGrades(grades: { name: string; grade: string }[] | undefined): DisplayGrade[] {
  if (!grades?.length) return [];
  const out: DisplayGrade[] = [];
  for (const g of grades) {
    const grade = translateGrade(g.grade);
    if (!grade) continue;
    out.push({ grade, grader: graderName(g.name), tone: gradeTone(g.grade) });
  }
  return out;
}
