import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { lastSession, playSurah, resumeLast, track } from '../../audio/player';
import { findRecitation, loadRecitations } from '../../audio/reciters';
import { arNum } from '../../lib/arabic';
import { shareText } from '../../lib/device';
import { gregorianDate, hijriDate } from '../../lib/format';
import { chapter, chapterAtPage, juzAtPage, parseKey, surahText } from '../../quran/data';
import { prefs } from '../../state/prefs';
import { lastRead, streak, todayLog, werdTarget } from '../../state/progress';
import { Icon, type IconName } from '../../ui/Icon';
import { Ring } from '../../ui/kit';
import { ayahOfTheDay } from './ayat';
import { HadithWidget, HomeWidgets } from './widgets';
import './home.css';

const QUICK: { path: string; label: string; icon: IconName }[] = [
  { path: '/mushaf', label: 'المصحف', icon: 'book' },
  { path: '/listen', label: 'الاستماع', icon: 'headphones' },
  { path: '/azkar', label: 'الأذكار', icon: 'sun' },
  { path: '/prayer', label: 'المواقيت', icon: 'clock' },
  { path: '/qibla', label: 'القبلة', icon: 'compass' },
  { path: '/tasbeeh', label: 'السبحة', icon: 'beads' },
  { path: '/radio', label: 'الإذاعة', icon: 'radio' },
  { path: '/tafsir', label: 'التفسير', icon: 'scroll' },
];

function greeting(h: number) {
  if (h >= 4 && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 18) return 'طاب يومك';
  return 'مساء الخير';
}

export default function HomePage() {
  const now = new Date();
  const page = lastRead.value.page || 1;
  const c = chapterAtPage(page);
  const read = todayLog.value.pages.length;
  const target = werdTarget.value;
  const key = ayahOfTheDay(now);
  const [s, a] = parseKey(key);
  const ayah = useSignal('');

  useEffect(() => {
    surahText(s)
      .then((d) => (ayah.value = d.v[a - 1] ?? ''))
      .catch(() => {});
    if (lastSession.value) void loadRecitations().catch(() => {});
  }, [key]);

  useEffect(() => {
    // When idle, fetch the reader and the last-read page so "افتح المصحف" opens instantly.
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))) as (cb: () => void) => number;
    idle(() => void import('../mushaf/PageView').then((m) => m.prefetchPage(lastRead.peek().page || 1)));
  }, []);

  const session = lastSession.value;
  const sessionRec = session ? findRecitation(session.recitation) : undefined;
  const werdDone = read >= target;

  return (
    <div class="home">
      <header class="home-head">
        <div>
          <p class="home-greet">{greeting(now.getHours())}</p>
          <h1 class="home-date display">{hijriDate(now, prefs.value.hijriAdjust)}</h1>
          <p class="home-sub">{gregorianDate(now)}</p>
        </div>
        {streak.value > 0 && (
          <a href="/werd" class="streak-pill" title="أيام متتالية من القراءة أو الذكر">
            <Icon name="flame" size={18} />
            <span>{arNum(streak.value)}</span>
            <small>{streak.value === 1 ? 'يوم' : streak.value === 2 ? 'يومان' : streak.value <= 10 ? 'أيام' : 'يومًا'}</small>
          </a>
        )}
      </header>

      <section class="home-hero card">
        <div class="hero-text">
          <span class="hero-label">
            <Icon name="book" size={16} /> تابع القراءة
          </span>
          <h2 class="display">سورة {c.ar}</h2>
          <p class="muted">
            صفحة {arNum(page)} · الجزء {arNum(juzAtPage(page))}
          </p>
          <div class="hero-actions">
            <a class="btn" href={`/mushaf/${page}`}>
              <Icon name="book" size={18} /> افتح المصحف
            </a>
            <a class="btn btn-ghost" href="/werd">
              وردي
            </a>
          </div>
        </div>
        <a href="/werd" class="hero-ring" title={`ورد اليوم: ${arNum(read)} من ${arNum(target)} صفحات`}>
          <Ring value={read} max={target} size={112} stroke={9}>
            <span class="ring-num">
              {werdDone ? <Icon name="check" size={30} /> : read ? arNum(read) : <small class="ring-start">ابدأ</small>}
            </span>
          </Ring>
          <span class="hero-ring-label">{werdDone ? 'أتممت ورد اليوم' : `ورد اليوم ${arNum(target)} صفحات`}</span>
        </a>
      </section>

      <HomeWidgets />

      {session && !track.value && (
        <button class="home-card card resume" onClick={resumeLast}>
          <span class="home-card-icon accent">
            <Icon name="play" size={18} />
          </span>
          <span class="home-card-text">
            <span class="home-card-label">تابع الاستماع</span>
            <span class="home-card-title">سورة {chapter(session.surah).ar}</span>
            {sessionRec && <span class="home-card-sub">{sessionRec.name}</span>}
          </span>
          <Icon name="chevronLeft" size={20} />
        </button>
      )}

      <section class="home-ayah card" aria-labelledby="home-ayah-title">
        <div class="home-ayah-head">
          <h2 id="home-ayah-title">
            <Icon name="feather" size={18} /> آية اليوم
          </h2>
          <span class="tag">
            سورة {chapter(s).ar} · {arNum(a)}
          </span>
        </div>
        <p class="quran-text home-ayah-text">
          {ayah.value ? (
            <>
              {ayah.value} <span class="ayah-num">{arNum(a)}</span>
            </>
          ) : (
            <span class="skeleton-line" style={{ display: 'block', height: '1.4em' }} />
          )}
        </p>
        <div class="home-ayah-actions">
          <button class="chip" onClick={() => playSurah(s, { ayah: a })}>
            <Icon name="headphones" size={14} /> استمع
          </button>
          <a class="chip" href={`/tafsir/${s}?a=${a}`}>
            <Icon name="scroll" size={14} /> التفسير
          </a>
          <button class="chip" onClick={() => shareText(`﴿${ayah.value}﴾ [${chapter(s).ar}: ${arNum(a)}]`)}>
            <Icon name="share" size={14} /> مشاركة
          </button>
        </div>
      </section>

      <HadithWidget />

      <h2 class="section-title">الأقسام</h2>
      <nav class="quick-grid" aria-label="الوصول السريع">
        {QUICK.map((q) => (
          <a key={q.path} href={q.path} class="quick-item">
            <span class="quick-icon">
              <Icon name={q.icon} size={24} />
            </span>
            <span>{q.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
