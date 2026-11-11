import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { copyText, shareText } from '../../lib/device';
import { bytes } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { PageHeader, Skeleton } from '../../ui/kit';
import { BOOKS, type BookInfo } from './catalog';
import { hadithOfTheDay, type DailyHadith } from './daily';
import { isBookCached } from './data';
import { compilerLine, hadithCount, lastRead, num } from './format';

export function Library() {
  const cached = useSignal<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    void Promise.all(BOOKS.map(async (b) => [b.slug, await isBookCached(b.slug)] as const)).then((pairs) => {
      if (alive) cached.value = Object.fromEntries(pairs);
    });
    return () => {
      alive = false;
    };
  }, []);

  const six = BOOKS.filter((b) => b.group === 'six');
  const other = BOOKS.filter((b) => b.group === 'other');

  return (
    <div class="hadith-page">
      <PageHeader title="الأحاديث النبوية" subtitle="كتب السنة المشهورة للقراءة والبحث، وتعمل دون اتصال بعد تنزيلها" />
      <DailyCard />

      <h2 class="section-title">الكتب الستة</h2>
      <div class="hd-book-grid">
        {six.map((b) => (
          <BookCard key={b.slug} book={b} cached={!!cached.value[b.slug]} />
        ))}
      </div>

      <h2 class="section-title">كتب ومختارات أخرى</h2>
      <div class="hd-book-grid">
        {other.map((b) => (
          <BookCard key={b.slug} book={b} cached={!!cached.value[b.slug]} />
        ))}
      </div>

      <p class="hint hadith-credit">
        النصوص من مشروع <bdi>hadith-api</bdi> المفتوح المصدر، والأحكام منسوبة إلى أصحابها المذكورين مع كل حديث.
      </p>
    </div>
  );
}

function BookCard({ book: b, cached }: { book: BookInfo; cached: boolean }) {
  const last = lastRead.value[b.slug];
  return (
    <a class={`hd-book-card card hd-group-${b.group}`} href={`/hadith/${b.slug}`}>
      <span class="hd-book-spine" aria-hidden="true" />
      <span class="hd-book-body">
        <span class="hd-book-name">{b.name}</span>
        <span class="hd-book-author">{compilerLine(b)}</span>
        <span class="hd-book-meta">
          <span class="tag">{hadithCount(b.count)}</span>
          {cached ? (
            <span class="tag tag-primary">
              <Icon name="check" size={13} /> متاح دون اتصال
            </span>
          ) : (
            <span class="tag" title="حجم التنزيل التقريبي">
              <Icon name="download" size={13} /> {bytes(b.gzBytes)}
            </span>
          )}
        </span>
        {last ? <span class="hd-book-last">آخر قراءة: الحديث {num(last)}</span> : null}
      </span>
      <Icon name="chevronLeft" size={20} class="hd-book-go" />
    </a>
  );
}

function DailyCard() {
  const daily = useSignal<DailyHadith | null>(null);
  const failed = useSignal(false);
  const expanded = useSignal(false);

  const load = () => {
    failed.value = false;
    hadithOfTheDay()
      .then((d) => (daily.value = d))
      .catch(() => (failed.value = true));
  };
  useEffect(load, []);

  const d = daily.value;
  const long = !!d && d.text.length > 420;
  const body = d ? `${d.text}\n\n${d.bookName}، الحديث ${num(d.number)}` : '';

  return (
    <section class="hd-daily-hadith card" aria-labelledby="daily-title">
      <div class="hd-daily-head">
        <h2 id="daily-title" class="hd-daily-label">
          حديث اليوم
        </h2>
        {d && (
          <span class="tag tag-accent">
            {d.bookName} · الحديث {num(d.number)}
          </span>
        )}
      </div>
      {d ? (
        <>
          <p class={`hadith-text hd-daily-text${long && !expanded.value ? ' hd-clamped' : ''}`} id="hd-daily-text">
            {d.text}
          </p>
          <div class="hd-daily-actions">
            {long && (
              <button
                class="btn btn-sm btn-ghost"
                onClick={() => (expanded.value = !expanded.value)}
                aria-expanded={expanded.value}
                aria-controls="hd-daily-text"
              >
                {expanded.value ? 'عرض أقل' : 'الحديث كاملًا'}
              </button>
            )}
            <a class="btn btn-sm btn-outline" href={d.href}>
              في كتابه
            </a>
            <span class="hd-daily-spacer" />
            <button class="icon-btn" onClick={() => void copyText(body, 'تم نسخ الحديث')} aria-label="نسخ حديث اليوم">
              <Icon name="copy" size={19} />
            </button>
            <button class="icon-btn" onClick={() => void shareText(body, 'حديث اليوم')} aria-label="مشاركة حديث اليوم">
              <Icon name="share" size={19} />
            </button>
          </div>
        </>
      ) : failed.value ? (
        <div class="hd-daily-error">
          <span>تعذر تحميل حديث اليوم.</span>
          <button class="btn btn-sm btn-ghost" onClick={load}>
            <Icon name="refresh" size={16} /> إعادة المحاولة
          </button>
        </div>
      ) : (
        <Skeleton lines={4} />
      )}
    </section>
  );
}
