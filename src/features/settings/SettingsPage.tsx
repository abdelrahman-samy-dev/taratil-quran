import type { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { hijriDate, timeOfDay } from '../../lib/format';
import { DEFAULT_PREFS, prefs, setPref, type MushafTone, type Shape, type Theme } from '../../state/prefs';
import { Icon, type IconName } from '../../ui/Icon';
import { PageHeader, Switch } from '../../ui/kit';
import { APP_VERSION } from './backup';
import { ChoiceGroup, Slider, useConfirm } from './controls';
import { DataSection } from './DataSection';
import { ListeningSection } from './ListeningSection';
import './settings.css';

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'set-appearance', label: 'المظهر', icon: 'sliders' },
  { id: 'set-reading', label: 'القراءة', icon: 'book' },
  { id: 'set-listening', label: 'الاستماع', icon: 'headphones' },
  { id: 'set-time', label: 'التاريخ والوقت', icon: 'calendar' },
  { id: 'set-interaction', label: 'التفاعل', icon: 'zap' },
  { id: 'set-data', label: 'البيانات', icon: 'layers' },
  { id: 'set-about', label: 'حول تراتيل', icon: 'info' },
];

const REPO = 'https://github.com/abdelrahman-samy-dev/taratil-quran';
const FATIHA_2 = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ';

const pct = (v: number) => `${arNum(Math.round(v * 100))}٪`;
const round2 = (v: number) => Math.round(v * 100) / 100;

export default function SettingsPage() {
  const [ask, confirmSheet] = useConfirm();
  const sec = (id: string) => SECTIONS.find((s) => s.id === id)!;
  const active = useSignal(SECTIONS[0].id);

  // Highlight the section being read in the index.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) active.value = seen[0].target.id;
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <div class="set">
      <PageHeader title="الإعدادات" subtitle="خصّص تراتيل كما يناسبك، وتُحفظ اختياراتك على هذا الجهاز" />
      <div class="set-layout">
        <nav class="set-toc" aria-label="أقسام الإعدادات">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              class={`set-toc-link${active.value === s.id ? ' active' : ''}`}
              aria-current={active.value === s.id ? 'location' : undefined}
            >
              <Icon name={s.icon} size={18} />
              <span>{s.label}</span>
            </a>
          ))}
        </nav>

        <div class="set-main">
          <Section {...sec('set-appearance')}>
            <AppearanceSection />
          </Section>
          <Section {...sec('set-reading')}>
            <ReadingSection />
          </Section>
          <Section {...sec('set-listening')}>
            <ListeningSection ask={ask} />
          </Section>
          <Section {...sec('set-time')}>
            <TimeSection />
          </Section>
          <Section {...sec('set-interaction')}>
            <Switch
              label="الاهتزاز عند اللمس"
              hint={
                typeof navigator !== 'undefined' && 'vibrate' in navigator
                  ? 'في السبحة وبعض الأزرار'
                  : 'لا يدعم هذا الجهاز الاهتزاز'
              }
              checked={prefs.value.haptics}
              onChange={(v) => setPref('haptics', v)}
            />
          </Section>
          <Section {...sec('set-data')}>
            <DataSection ask={ask} />
          </Section>
          <Section {...sec('set-about')}>
            <AboutSection />
          </Section>
        </div>
      </div>
      {confirmSheet}
    </div>
  );
}

function Section({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: IconName;
  children: ComponentChildren;
}) {
  return (
    <section class="card set-section" id={id} aria-labelledby={`${id}-h`}>
      <h2 class="set-section-title" id={`${id}-h`}>
        <span class="set-section-icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        {label}
      </h2>
      {children}
    </section>
  );
}

/* ── المظهر ─────────────────────────────────────────────────────────────── */

function ThemeArt({ t }: { t: Theme }) {
  return (
    <span class={`sw-theme t-${t}`}>
      <span class="sw-top" />
      <span class="sw-card">
        <i />
        <i />
      </span>
      <span class="sw-pill" />
    </span>
  );
}

function ShapeArt({ s }: { s: Shape }) {
  return (
    <span class={`sw-shape s-${s}`}>
      <span class="sw-shape-card">
        <i />
        <i />
      </span>
      <span class="sw-shape-btn" />
    </span>
  );
}

function AppearanceSection() {
  const p = prefs.value;
  return (
    <>
      <div class="set-block">
        <ChoiceGroup<Theme>
          name="set-theme"
          legend="السمة"
          variant="cards"
          class="set-swatches"
          value={p.theme}
          onChange={(v) => setPref('theme', v)}
          options={[
            { value: 'system', label: 'تلقائي', hint: 'حسب الجهاز', art: <ThemeArt t="system" /> },
            { value: 'light', label: 'فاتح', hint: 'للنهار', art: <ThemeArt t="light" /> },
            { value: 'dark', label: 'داكن', hint: 'مريح ليلاً', art: <ThemeArt t="dark" /> },
            { value: 'amoled', label: 'أسود', hint: 'يوفّر البطارية', art: <ThemeArt t="amoled" /> },
          ]}
        />
      </div>

      <div class="set-block">
        <ChoiceGroup<Shape>
          name="set-shape"
          legend="شكل الواجهة"
          variant="cards"
          class="set-swatches set-shapes"
          value={p.shape}
          onChange={(v) => setPref('shape', v)}
          options={[
            { value: 'rounded', label: 'مستدير', art: <ShapeArt s="rounded" /> },
            { value: 'sharp', label: 'حاد', art: <ShapeArt s="sharp" /> },
            { value: 'minimal', label: 'بسيط', art: <ShapeArt s="minimal" /> },
          ]}
        />
      </div>

      <div class="set-block">
        <Slider
          id="set-font-scale"
          label="حجم خط الواجهة"
          min={0.85}
          max={1.3}
          step={0.05}
          value={p.fontScale}
          display={pct(p.fontScale)}
          onInput={(v) => setPref('fontScale', round2(v))}
        />
        <p class="set-preview">هكذا يظهر النص في تراتيل: القوائم والأزرار والشروح.</p>
        {p.fontScale !== DEFAULT_PREFS.fontScale && (
          <button class="set-reset" onClick={() => setPref('fontScale', DEFAULT_PREFS.fontScale)}>
            <Icon name="refresh" size={14} /> الحجم الافتراضي
          </button>
        )}
      </div>

      <div class="set-block">
        <Slider
          id="set-quran-scale"
          label="حجم خط القرآن"
          hint="في التفسير والتسميع ومشغل التلاوة"
          min={0.8}
          max={1.8}
          step={0.05}
          value={p.quranScale}
          display={pct(p.quranScale)}
          onInput={(v) => setPref('quranScale', round2(v))}
        />
        <p class="quran-text set-quran-preview" lang="ar">
          {FATIHA_2}
        </p>
        {p.quranScale !== DEFAULT_PREFS.quranScale && (
          <button class="set-reset" onClick={() => setPref('quranScale', DEFAULT_PREFS.quranScale)}>
            <Icon name="refresh" size={14} /> الحجم الافتراضي
          </button>
        )}
      </div>
    </>
  );
}

/* ── القراءة ────────────────────────────────────────────────────────────── */

function ReadingSection() {
  const p = prefs.value;
  return (
    <>
      <Switch
        label="إبقاء الشاشة مضاءة"
        hint="أثناء قراءة المصحف والأذكار"
        checked={p.keepAwake}
        onChange={(v) => setPref('keepAwake', v)}
      />
      <Switch
        label="صفحتان متجاورتان"
        hint="على الشاشات العريضة كالحاسوب والجهاز اللوحي"
        checked={p.mushafSpread}
        onChange={(v) => setPref('mushafSpread', v)}
      />

      <div class="set-block">
        <ChoiceGroup<MushafTone>
          name="set-tone"
          legend="لون صفحة المصحف"
          variant="cards"
          class="set-swatches set-tones"
          value={p.mushafTone}
          onChange={(v) => setPref('mushafTone', v)}
          options={[
            { value: 'paper', label: 'ورقي', art: <span class="sw-tone tone-paper" /> },
            { value: 'white', label: 'أبيض', art: <span class="sw-tone tone-white" /> },
            { value: 'sepia', label: 'بُنّي', art: <span class="sw-tone tone-sepia" /> },
          ]}
        />
      </div>

      <div class="set-block">
        <Slider
          id="set-dim"
          label="التعتيم الليلي"
          hint="يخفّف سطوع صفحة المصحف للقراءة في الظلام"
          min={0}
          max={0.6}
          step={0.05}
          value={p.mushafDim}
          display={p.mushafDim === 0 ? 'بلا' : pct(p.mushafDim)}
          onInput={(v) => setPref('mushafDim', round2(v))}
        />
        <div
          class={`set-page-preview tone-${p.mushafTone}`}
          style={{ '--dim': String(p.mushafDim) }}
          aria-hidden="true"
        >
          <span class="quran-text">{FATIHA_2}</span>
        </div>
      </div>
    </>
  );
}

/* ── التاريخ والوقت ──────────────────────────────────────────────────────── */

function signed(n: number): string {
  if (n > 0) return `+${arNum(n)}`;
  if (n < 0) return `−${arNum(-n)}`;
  return arNum(0);
}

function TimeSection() {
  const p = prefs.value;
  const now = new Date();
  const adj = p.hijriAdjust;
  const set = (v: number) => setPref('hijriAdjust', Math.max(-2, Math.min(2, v)));

  return (
    <>
      <div class="setting-row set-static">
        <span class="setting-text">
          <span class="setting-label" id="set-hijri-label">
            تعديل التاريخ الهجري
          </span>
          <span class="setting-hint">
            اليوم: <b class="set-hijri">{hijriDate(now, adj)}</b>
          </span>
        </span>
        <div class="set-stepper" role="group" aria-labelledby="set-hijri-label">
          <button class="icon-btn" onClick={() => set(adj + 1)} disabled={adj >= 2} aria-label="تقديم يوم">
            <Icon name="plus" size={18} />
          </button>
          <output class="set-stepper-value" aria-live="polite" aria-label={`التعديل ${signed(adj)} يوم`}>
            {signed(adj)}
          </output>
          <button class="icon-btn" onClick={() => set(adj - 1)} disabled={adj <= -2} aria-label="تأخير يوم">
            <Icon name="minus" size={18} />
          </button>
        </div>
      </div>

      <div class="set-block set-block-row">
        <ChoiceGroup
          name="set-clock"
          legend="نظام الساعة"
          value={p.hour12 ? '12' : '24'}
          onChange={(v) => setPref('hour12', v === '12')}
          options={[
            { value: '12', label: '١٢ ساعة' },
            { value: '24', label: '٢٤ ساعة' },
          ]}
        />
        <span class="set-clock-preview" aria-live="polite">
          <Icon name="clock" size={16} /> {timeOfDay(now, undefined, p.hour12)}
        </span>
      </div>
    </>
  );
}

/* ── حول تراتيل ─────────────────────────────────────────────────────────── */

const CREDITS: { what: string; who: ComponentChildren }[] = [
  {
    what: 'نص القرآن وخطوط المصحف',
    who: (
      <span class="set-credit-links">
        <a href="https://quran.foundation" target="_blank" rel="noopener noreferrer">
          Quran.com / Quran Foundation
        </a>
        <a href="https://qurancomplex.gov.sa" target="_blank" rel="noopener noreferrer">
          مجمع الملك فهد لطباعة المصحف الشريف
        </a>
      </span>
    ),
  },
  {
    what: 'التلاوات وتوقيت الآيات',
    who: (
      <a href="https://mp3quran.net" target="_blank" rel="noopener noreferrer">
        mp3quran.net
      </a>
    ),
  },
  {
    what: 'التفسير',
    who: (
      <a href="https://alquran.cloud" target="_blank" rel="noopener noreferrer">
        alquran.cloud
      </a>
    ),
  },
  {
    what: 'الأحاديث',
    who: (
      <a href="https://github.com/fawazahmed0/hadith-api" target="_blank" rel="noopener noreferrer">
        fawazahmed0/hadith-api
      </a>
    ),
  },
  {
    what: 'مواقيت الصلاة',
    who: (
      <a href="https://github.com/batoulapps/adhan-js" target="_blank" rel="noopener noreferrer">
        adhan-js
      </a>
    ),
  },
  {
    what: 'البحث عن المدن',
    who: (
      <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">
        Open-Meteo
      </a>
    ),
  },
];

type UpdateState = { kind: 'idle' | 'checking' | 'ok' | 'found' | 'none' | 'error'; text: string };

async function checkForUpdates(): Promise<UpdateState> {
  if (!('serviceWorker' in navigator)) return { kind: 'none', text: 'لا يدعم هذا المتصفح التحديث التلقائي.' };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { kind: 'none', text: 'التحديث التلقائي غير مفعّل في هذه النسخة.' };
    await reg.update();
    if (reg.installing || reg.waiting) {
      return { kind: 'found', text: 'يتوفر إصدار جديد، وسيظهر زر التحديث أعلى الصفحة عند اكتمال تنزيله.' };
    }
    return { kind: 'ok', text: 'أنت تستخدم أحدث إصدار.' };
  } catch {
    return { kind: 'error', text: 'تعذر التحقق الآن. تأكد من الاتصال وحاول مرة أخرى.' };
  }
}

function AboutSection() {
  const state = useSignal<UpdateState>({ kind: 'idle', text: '' });
  const check = async () => {
    state.value = { kind: 'checking', text: 'جارٍ التحقق…' };
    state.value = await checkForUpdates();
  };

  return (
    <>
      <div class="set-about-head">
        <span class="set-about-logo" aria-hidden="true">
          <Icon name="logo" size={34} />
        </span>
        <div>
          <p class="set-about-name display">تراتيل</p>
          <p class="setting-hint">الإصدار {arNum(APP_VERSION)} · مجاني ومفتوح المصدر، بلا إعلانات</p>
        </div>
      </div>

      <div class="set-actions">
        <button class="btn btn-outline" onClick={check} disabled={state.value.kind === 'checking'}>
          <Icon name="refresh" size={18} /> التحقق من التحديثات
        </button>
        <a class="btn btn-ghost" href={REPO} target="_blank" rel="noopener noreferrer">
          <Icon name="share" size={18} /> الشيفرة المصدرية
        </a>
      </div>
      <p class={`set-update ${state.value.kind}`} role="status" aria-live="polite">
        {state.value.text}
      </p>

      <div class="set-block">
        <h3 class="set-sub">مصادر البيانات</h3>
        <dl class="set-credits">
          {CREDITS.map((c) => (
            <div key={c.what}>
              <dt>{c.what}</dt>
              <dd>{c.who}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p class="set-made">
        من إعداد <b>عبد الرحمن سامي</b>. نسأل الله أن ينفع به.
      </p>
    </>
  );
}
