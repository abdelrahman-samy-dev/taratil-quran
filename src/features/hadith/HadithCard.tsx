import { memo } from 'preact/compat';
import { copyText, shareText } from '../../lib/device';
import { Icon } from '../../ui/Icon';
import type { BookInfo } from './catalog';
import { cleanText, highlight, type Hadith } from './data';
import { altLabel, num } from './format';
import { displayGrades, type DisplayGrade } from './grades';

interface Props {
  hadith: Hadith;
  index: number;
  info: BookInfo;
  /** Section title shown on the card (search results). */
  section?: string;
  /** Normalised search terms to highlight. */
  terms?: string[];
  flash?: boolean;
}

function shareBody(h: Hadith, info: BookInfo, grades: DisplayGrade[]): string {
  const lines = [cleanText(h.text), '', `${info.name}، حديث رقم ${num(h.n)}`];
  if (grades.length) {
    lines.push(`الحكم: ${grades.map((g) => (g.grader ? `${g.grade} (${g.grader})` : g.grade)).join('، ')}`);
  }
  return lines.join('\n');
}

export const HadithCard = memo(function HadithCard({ hadith: h, index, info, section, terms, flash }: Props) {
  const text = cleanText(h.text);
  const grades = displayGrades(h.grades);
  const parts = terms?.length ? highlight(text, terms) : null;
  const label = `${info.name}، الحديث ${num(h.n)}`;

  return (
    <article
      class={`hadith-card card${flash ? ' hd-flash' : ''}`}
      id={`h-${index}`}
      data-i={index}
      aria-label={label}
    >
      <header class="hadith-head">
        <span class="hadith-num" title="رقم الحديث">
          <span class="sr-only">رقم الحديث </span>
          {num(h.n)}
        </span>
        <span class="hadith-tags">
          {h.alt && info.altNumbering && (
            <span class="tag" title={info.altNumbering}>
              عبد الباقي {altLabel(h.alt)}
            </span>
          )}
          {section && <span class="tag tag-primary hadith-sec">{section}</span>}
        </span>
        <span class="hadith-actions">
          <button
            class="icon-btn"
            onClick={() => void copyText(shareBody(h, info, grades), 'تم نسخ الحديث')}
            aria-label={`نسخ ${label}`}
          >
            <Icon name="copy" size={19} />
          </button>
          <button
            class="icon-btn"
            onClick={() => void shareText(shareBody(h, info, grades), info.name)}
            aria-label={`مشاركة ${label}`}
          >
            <Icon name="share" size={19} />
          </button>
        </span>
      </header>
      <p class="hadith-text" lang="ar">
        {parts ? parts.map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : p.t)) : text}
      </p>
      {grades.length > 0 && (
        <ul class="hadith-grades" aria-label="الحكم على الحديث">
          {grades.map((g, i) => (
            <li key={i} class={`hd-grade hd-tone-${g.tone}`}>
              <span class="hd-grade-value">{g.grade}</span>
              {g.grader && <span class="hd-grade-by">{g.grader}</span>}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
});
