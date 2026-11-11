import { useSignal } from '@preact/signals';
import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { arNum } from '../../lib/arabic';
import { haptic, holdWakeLock } from '../../lib/device';
import { prefs } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { Progress, Segmented } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { CATEGORIES, getCategory } from './azkar-data';
import { azkarSummary, azkarToday, nextUnfinished, progressOf, resetAzkar, suggestedCategory, tapZekr, undoZekr } from './azkar-state';
import { ZekrCard } from './ZekrCard';
import './azkar.css';

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function AzkarPage() {
  const { params } = useRoute();
  const { route } = useLocation();
  const cat = getCategory(params.cat) ?? getCategory(suggestedCategory())!;
  const targets = useMemo(() => cat.items.map((i) => i.count), [cat]);

  const counts = azkarToday.value.counts[cat.id];
  const p = progressOf(counts, targets);

  const confirmOpen = useSignal(false);
  const announce = useSignal('');
  const headRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const doneRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);

  // Keep the screen on while reading, if the user wants it.
  const keepAwake = prefs.value.keepAwake;
  useEffect(() => {
    if (!keepAwake) return;
    return holdWakeLock();
  }, [keepAwake]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Bring the selected tab into view in the scrolling tab strip.
  useEffect(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [cat.id]);

  /** Scrolls `el` just below the sticky header, after the done state has painted. */
  const reveal = useCallback((find: () => HTMLElement | null | undefined, focus: boolean) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = find();
      if (!el) return;
      const headBottom = headRef.current?.getBoundingClientRect().bottom ?? 0;
      const top = el.getBoundingClientRect().top + window.scrollY - Math.max(0, headBottom) - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
      if (focus) {
        const target = el.matches('.zekr') ? el.querySelector<HTMLElement>('.zekr-count') : el;
        target?.focus({ preventScroll: true });
      }
    }, 260);
  }, []);

  const onTap = useCallback(
    (index: number, fromKeyboard: boolean) => {
      const r = tapZekr(cat.id, index, targets);
      if (!r.counted) return;
      if (r.categoryDone) {
        haptic([40, 60, 40, 60, 90]);
        announce.value = `اكتملت ${cat.title}، تقبّل الله`;
        reveal(() => doneRef.current, fromKeyboard);
      } else if (r.itemDone) {
        haptic([30, 50, 30]);
        announce.value = 'تمّ هذا الذكر';
        const next = nextUnfinished(r.state.counts[cat.id], targets, index);
        if (next >= 0) reveal(() => listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`), fromKeyboard);
      } else {
        haptic(12);
        announce.value = `بقي ${arNum(r.remaining)}`;
      }
    },
    [cat, targets],
  );

  const onUndo = useCallback(
    (index: number) => {
      undoZekr(cat.id, index);
      haptic(8);
      announce.value = 'تم التراجع عن عدّة';
    },
    [cat.id],
  );

  const doReset = () => {
    resetAzkar(cat.id);
    confirmOpen.value = false;
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    toast(`أُعيد عدّاد ${cat.title}`);
  };

  const tabs = CATEGORIES.map((c) => ({
    value: c.id,
    label: (
      <>
        {c.short}
        {azkarSummary(c.id).complete && <Icon name="check" size={14} class="azkar-tab-check" label="مكتملة" />}
      </>
    ),
  }));

  return (
    <div class="azkar">
      <div class="azkar-tabs" ref={tabsRef}>
        <Segmented scroll label="أقسام الأذكار" value={cat.id} options={tabs} onChange={(id) => route(`/azkar/${id}`, true)} />
      </div>

      <div class={`azkar-head${p.complete ? ' is-complete' : ''}`} ref={headRef}>
        <div class="azkar-head-row">
          <div class="azkar-head-text">
            <h1 class="azkar-title">{cat.title}</h1>
            <p class="azkar-sub">
              <span>
                {arNum(p.done)} من {arNum(p.total)}
              </span>
              {p.complete && <span class="tag tag-primary">مكتملة</span>}
            </p>
          </div>
          <button
            type="button"
            class="icon-btn"
            aria-label={`إعادة البدء في ${cat.title}`}
            title="إعادة البدء"
            disabled={p.reps === 0}
            onClick={() => (confirmOpen.value = true)}
          >
            <Icon name="refresh" size={20} />
          </button>
        </div>
        <Progress value={p.done} max={p.total} label={`التقدّم في ${cat.title}`} />
      </div>

      {p.reps === 0 && (
        <p class="azkar-hint">
          <Icon name="info" size={16} />
          اضغط على البطاقة لعدّ كل مرة.
        </p>
      )}

      <ol class="zekr-list" ref={listRef}>
        {cat.items.map((item, i) => (
          <ZekrCard
            key={`${cat.id}-${i}`}
            item={item}
            index={i}
            count={counts?.[i] ?? 0}
            title={cat.title}
            onTap={onTap}
            onUndo={onUndo}
            attribution={cat.id === 'prophets'}
          />
        ))}
      </ol>

      {p.complete && (
        <section class="azkar-done card" ref={doneRef} tabIndex={-1} aria-labelledby="azkar-done-title">
          <span class="azkar-done-icon">
            <Icon name="checkCircle" size={30} />
          </span>
          <h2 id="azkar-done-title" class="azkar-done-title">
            تقبّل الله
          </h2>
          <p class="azkar-done-text">اكتملت {cat.title} لهذا اليوم.</p>
          <a class="btn btn-outline btn-sm" href="/tasbeeh">
            <Icon name="beads" size={18} />
            السبحة
          </a>
        </section>
      )}

      <p class="sr-only" aria-live="polite">
        {announce.value}
      </p>

      <Sheet open={confirmOpen.value} onClose={() => (confirmOpen.value = false)} title="إعادة البدء">
        <div class="azkar-confirm">
          <p>سيعود عدّاد «{cat.title}» إلى البداية لهذا اليوم.</p>
          <div class="azkar-confirm-actions">
            <button type="button" class="btn btn-danger" onClick={doReset}>
              إعادة البدء
            </button>
            <button type="button" class="btn btn-ghost" onClick={() => (confirmOpen.value = false)}>
              إلغاء
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
