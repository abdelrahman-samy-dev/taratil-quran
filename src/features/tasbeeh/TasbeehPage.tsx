import { computed, useSignal } from '@preact/signals';
import type { RefObject } from 'preact';
import { useCallback, useEffect, useRef } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { haptic } from '../../lib/device';
import { Icon } from '../../ui/Icon';
import { PageHeader, Segmented, Stat } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import {
  type Config,
  GUIDED_STEPS,
  type Mode,
  PRESETS,
  type Snapshot,
  type Target,
  TARGETS,
  config,
  configure,
  count,
  dhikrText,
  flush,
  guided,
  lifetimeCount,
  resetSession,
  restore,
  ringFraction,
  tap,
  todayCount,
  undo,
} from './tasbeeh-state';
import './tasbeeh.css';

/** Only changes when the step (or the chosen dhikr) changes, not on every tap. */
const currentText = computed(() => dhikrText(config.value, count.value));

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function offerUndo(text: string, prev: Snapshot | null) {
  if (prev && prev.count > 0) toast(text, { label: 'تراجع', run: () => restore(prev) }, 5000);
}

function change(patch: Partial<Config>) {
  offerUndo('بدأت جلسة جديدة', configure(patch));
}

export default function TasbeehPage() {
  const cfg = config.value;
  const customOpen = useSignal(false);
  const draft = useSignal('');
  const faceRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);

  const doTap = useCallback(() => {
    const kind = tap();
    if (kind === 'ignored') return;
    if (kind === 'tap') haptic(10);
    else if (kind === 'complete') haptic([60, 80, 60, 80, 140]);
    else haptic([35, 45, 35]);
    if (reducedMotion()) return;
    // Compositor-only feedback: no layout work on the tap path.
    faceRef.current?.animate([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' });
    if (kind !== 'tap') {
      glowRef.current?.animate(
        [
          { opacity: 0.6, transform: 'scale(0.92)' },
          { opacity: 0, transform: 'scale(1.18)' },
        ],
        { duration: 750, easing: 'ease-out' },
      );
    }
  }, []);

  const doUndo = useCallback(() => {
    if (undo()) haptic(8);
  }, []);

  // Space / Enter count and Backspace / Ctrl+Z undo, unless the user is typing or a control has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || document.documentElement.classList.contains('modal-open')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable]')) return;
      const isUndo = e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z');
      if ((e.ctrlKey || e.metaKey) && !isUndo) return;
      if (e.key === ' ' || e.key === 'Enter') {
        // A focused control (including the counter itself) handles its own activation.
        if (t?.closest('button, a, [role="tab"]')) return;
        e.preventDefault();
        if (!e.repeat) doTap();
      } else if (isUndo) {
        e.preventDefault();
        if (!e.repeat) doUndo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      flush();
    };
  }, []);

  const openCustom = () => {
    draft.value = cfg.custom;
    customOpen.value = true;
  };

  const saveCustom = (e: Event) => {
    e.preventDefault();
    const v = draft.value.trim();
    if (!v) return;
    customOpen.value = false;
    change({ preset: 'custom', custom: v });
  };

  return (
    <div class="tb">
      <PageHeader title="السبحة" />

      <div class="tb-mode">
        <Segmented<Mode>
          label="نوع التسبيح"
          value={cfg.mode}
          onChange={(mode) => change({ mode })}
          options={[
            { value: 'free', label: 'تسبيح حرّ' },
            { value: 'guided', label: 'بعد الصلاة' },
          ]}
        />
      </div>

      <div class="tb-layout">
        <section class="tb-stage card" aria-label="العدّاد">
          <DhikrLine />
          {cfg.mode === 'guided' && <GuidedSteps />}
          <Orb onTap={doTap} faceRef={faceRef} glowRef={glowRef} />
          <Controls onUndo={doUndo} />
          <p class="tb-kbd">
            مفتاح المسافة للعدّ، ومفتاح <kbd>Backspace</kbd> للتراجع
          </p>
        </section>

        <div class="tb-panel">
          {cfg.mode === 'free' ? (
            <>
              <section class="card tb-card">
                <h2 class="tb-h">الذكر</h2>
                <div class="tb-presets" role="group" aria-label="اختر الذكر">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={cfg.preset === p.id}
                      class={`chip${cfg.preset === p.id ? ' active' : ''}`}
                      onClick={() => change({ preset: p.id })}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={cfg.preset === 'custom'}
                    class={`chip tb-custom-chip${cfg.preset === 'custom' ? ' active' : ''}`}
                    onClick={openCustom}
                    aria-label={cfg.preset === 'custom' ? `ذكر من اختيارك: ${cfg.custom}، اضغط للتعديل` : 'ذكر من اختيارك'}
                  >
                    <Icon name="feather" size={16} />
                    <span>{cfg.preset === 'custom' ? cfg.custom : 'ذكر آخر'}</span>
                  </button>
                </div>
              </section>

              <section class="card tb-card">
                <h2 class="tb-h">العدد المستهدف</h2>
                <Segmented<`${Target}`>
                  label="العدد المستهدف"
                  value={`${cfg.target}`}
                  onChange={(v) => change({ target: Number(v) as Target })}
                  options={TARGETS.map((t) => ({ value: `${t}` as `${Target}`, label: t ? arNum(t) : 'مفتوح' }))}
                />
              </section>
            </>
          ) : (
            <section class="card tb-card">
              <h2 class="tb-h">تسبيح ما بعد الصلاة</h2>
              <p class="tb-note">
                ثلاث وثلاثون تسبيحة، وثلاث وثلاثون تحميدة، وثلاث وثلاثون تكبيرة، ثم تمام المئة بـ«لا إله إلا الله وحده لا شريك له، له
                الملك وله الحمد، وهو على كل شيء قدير».
              </p>
              <p class="tb-source">
                «غُفِرَتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ»
                <span class="tag">صحيح مسلم {arNum(597)}</span>
              </p>
            </section>
          )}

          <SessionStats />
        </div>
      </div>

      <Sheet open={customOpen.value} onClose={() => (customOpen.value = false)} title="ذكر من اختيارك">
        <form class="tb-form" onSubmit={saveCustom}>
          <label class="tb-label" for="tb-custom">
            نص الذكر
          </label>
          <input
            id="tb-custom"
            class="input"
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="مثال: سبحان الله العظيم"
            value={draft.value}
            onInput={(e) => (draft.value = e.currentTarget.value)}
            autofocus
          />
          <div class="tb-form-actions">
            <button type="submit" class="btn" disabled={!draft.value.trim()}>
              اعتماد
            </button>
            <button type="button" class="btn btn-ghost" onClick={() => (customOpen.value = false)}>
              إلغاء
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}

function DhikrLine() {
  const text = currentText.value;
  return (
    <p class={`tb-dhikr${text.length > 40 ? ' is-long' : ''}`} key={text}>
      {text}
    </p>
  );
}

function GuidedSteps() {
  const g = guided.value;
  if (!g) return null;
  return (
    <ol class="tb-steps" aria-label="مراحل التسبيح">
      {GUIDED_STEPS.map((s, i) => {
        const state = g.done || i < g.step ? 'done' : i === g.step ? 'current' : '';
        const fill = state === 'done' ? 1 : state === 'current' ? g.inStep / g.stepCount : 0;
        return (
          <li key={i} class={`tb-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span class="tb-step-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${fill})` }} />
            </span>
            <span class="tb-step-label">
              {s.label} <bdi>{arNum(s.count)}</bdi>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Orb({
  onTap,
  faceRef,
  glowRef,
}: {
  onTap: () => void;
  faceRef: RefObject<HTMLSpanElement>;
  glowRef: RefObject<HTMLSpanElement>;
}) {
  const cfg = config.value;
  const n = count.value;
  const g = guided.value;
  const frac = ringFraction(cfg, n);

  let shown = n;
  let of = 'عدّ مفتوح';
  let rounds = 0;
  let live = arNum(n);
  if (g) {
    shown = g.done ? g.stepCount : g.inStep;
    of = `من ${arNum(g.stepCount)}`;
    live = g.done ? 'اكتمل تسبيح ما بعد الصلاة، تقبّل الله' : `${arNum(shown)} من ${arNum(g.stepCount)}`;
  } else if (cfg.target) {
    rounds = Math.floor(n / cfg.target);
    shown = n > 0 && n % cfg.target === 0 ? cfg.target : n % cfg.target;
    of = `من ${arNum(cfg.target)}`;
    live = shown === cfg.target ? `اكتملت ${arNum(cfg.target)}` : `${arNum(shown)} من ${arNum(cfg.target)}`;
  }
  const complete = !!g?.done;
  const hasRing = !!g || !!cfg.target;

  return (
    <div class="tb-orb-wrap">
      <button
        type="button"
        class={`tb-orb${complete ? ' is-complete' : ''}`}
        onClick={onTap}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.repeat && e.preventDefault()}
        aria-label={complete ? 'اكتمل التسبيح' : 'سبِّح، اضغط للعدّ'}
        aria-describedby="tb-live"
        aria-disabled={complete || undefined}
      >
        <span class="tb-glow" ref={glowRef} aria-hidden="true" />
        <svg class="tb-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="tb-ring-bg" cx="60" cy="60" r={RING_R} />
          {hasRing && (
            <circle
              class="tb-ring-fg"
              cx="60"
              cy="60"
              r={RING_R}
              stroke-dasharray={RING_C}
              stroke-dashoffset={RING_C * (1 - frac)}
              transform="rotate(-90 60 60)"
            />
          )}
        </svg>
        <span class="tb-face" ref={faceRef}>
          {complete ? (
            <>
              <Icon name="check" size={56} />
              <span class="tb-of">تقبّل الله</span>
            </>
          ) : (
            <>
              {shown === 0 ? (
                <span class="tb-start">اضغط للتسبيح</span>
              ) : (
                <span class="tb-num" key={n}>
                  {arNum(shown)}
                </span>
              )}
              <span class="tb-of">{of}</span>
              {rounds > 0 && <span class="tb-rounds">{`الدورات المكتملة: ${arNum(rounds)}`}</span>}
            </>
          )}
        </span>
      </button>
      <p id="tb-live" class="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

function Controls({ onUndo }: { onUndo: () => void }) {
  const n = count.value;
  const complete = !!guided.value?.done;
  const reset = () => offerUndo('تم تصفير العدّاد', resetSession());
  return (
    <div class="tb-controls">
      <button type="button" class="btn btn-ghost" onClick={onUndo} disabled={n === 0}>
        <Icon name="minus" size={18} />
        تراجع
      </button>
      <button type="button" class={`btn ${complete ? '' : 'btn-ghost'}`} onClick={reset} disabled={n === 0}>
        <Icon name="refresh" size={18} />
        {complete ? 'جولة جديدة' : 'تصفير'}
      </button>
    </div>
  );
}

function SessionStats() {
  return (
    <div class="grid tb-stats">
      <Stat icon="beads" label="هذه الجلسة" value={count.value} />
      <Stat icon="sun" label="اليوم" value={todayCount.value} />
      <Stat icon="award" label="الإجمالي" value={lifetimeCount.value} />
    </div>
  );
}
