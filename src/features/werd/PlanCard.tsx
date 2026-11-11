import type { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { addDays } from '../../lib/storage';
import { chapterAtPage } from '../../quran/data';
import { daysBetween, lastRead, log, planProgress, stats, today, werd, werdTarget } from '../../state/progress';
import { Icon } from '../../ui/Icon';
import { Progress } from '../../ui/kit';
import { toast } from '../../ui/toast';
import { ChoiceGroup, type Ask } from '../settings/controls';
import { settleKhatma } from './achievements';
import {
  MAX_PLAN_DAYS,
  PLAN_PRESETS,
  clampInt,
  countDays,
  countPages,
  dayLabel,
  dayWord,
  expectedBy,
  pace,
  pageWord,
  planEnd,
  planFinishDay,
  planPace,
  planTotal,
  surahRangeLabel,
  todayPortion,
  type Pace,
  type Plan,
} from './logic';

export function PlanCard({ ask }: { ask: Ask }) {
  const plan = werd.value.plan;
  const prog = planProgress.value;
  if (!plan || !prog) return <PlanSetup />;
  if (prog.read >= prog.total) return <PlanDone plan={plan} />;
  return <PlanActive plan={plan} ask={ask} />;
}

function CardHead({ title, sub, side }: { title: string; sub?: string; side?: ComponentChildren }) {
  return (
    <header class="werd-card-head">
      <span class="werd-card-icon" aria-hidden="true">
        <Icon name="calendar" size={20} />
      </span>
      <div class="werd-card-titles">
        <h2 id="werd-plan-title">{title}</h2>
        {sub && <p class="hint">{sub}</p>}
      </div>
      {side}
    </header>
  );
}

/* ── No plan yet ─────────────────────────────────────────────────────────── */

function PlanSetup() {
  const days = useSignal<number>(30);
  const custom = useSignal(false);
  const from = useSignal<'start' | 'last'>('start');
  const last = lastRead.value.page;
  const canResume = last > 1;
  const fromPage = from.value === 'last' && canResume ? last : 1;
  const perDay = planPace(fromPage, days.value);
  const end = dayLabel(addDays(today.value, days.value - 1));

  const start = () => {
    werd.value = { ...werd.value, plan: { start: today.value, days: days.value, fromPage } };
    toast('بدأت خطة الختمة، وفّقك الله');
  };

  return (
    <section class="card werd-card werd-plan" aria-labelledby="werd-plan-title">
      <CardHead title="خطة ختمة" sub="اختر المدة ونقطة البداية، وتُقسَّم الصفحات على الأيام بالتساوي." />

      <ChoiceGroup
        name="werd-plan-days"
        legend="مدة الختمة"
        class="werd-days"
        value={custom.value ? 0 : days.value}
        options={[
          ...PLAN_PRESETS.map((d) => ({ value: d as number, label: `${arNum(d)} ${dayWord(d)}` })),
          { value: 0, label: 'مدة أخرى' },
        ]}
        onChange={(v) => {
          custom.value = v === 0;
          if (v) days.value = v;
        }}
      />
      {custom.value && (
        <label class="werd-inline-input">
          <span>عدد الأيام</span>
          <input
            class="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_PLAN_DAYS}
            value={days.value}
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              if (v >= 1) days.value = clampInt(v, 1, MAX_PLAN_DAYS);
            }}
          />
        </label>
      )}

      <ChoiceGroup
        name="werd-plan-from"
        legend="البداية"
        variant="cards"
        class="werd-from"
        value={from.value}
        options={[
          { value: 'start', label: 'من أول المصحف', hint: 'سورة الفاتحة · صفحة ١' },
          {
            value: 'last',
            label: 'من حيث توقفت',
            hint: canResume ? `سورة ${chapterAtPage(last).ar} · صفحة ${arNum(last)}` : 'لم تبدأ القراءة بعد',
            disabled: !canResume,
          },
        ]}
        onChange={(v) => (from.value = v)}
      />

      <p class="werd-plan-preview">
        <Icon name="info" size={18} />
        <span>
          نحو <b>{countPages(perDay)}</b> يومياً ({countPages(planTotal(fromPage))} إجمالاً)، وتختم بإذن الله يوم{' '}
          <b>{end}</b>.
        </span>
      </p>

      <button class="btn btn-block" onClick={start}>
        <Icon name="check" size={18} /> ابدأ الخطة
      </button>
    </section>
  );
}

/* ── Active plan ─────────────────────────────────────────────────────────── */

function paceText(p: Pace, over: boolean, left: number): string {
  if (over) return `انتهت المدة المحددة، وبقي لك ${countPages(left)} لإتمام الختمة.`;
  const n = p.pages;
  const amount = n === 1 ? 'بصفحة واحدة' : n === 2 ? 'بصفحتين' : `بـ${arNum(n)} ${pageWord(n)}`;
  if (p.kind === 'ahead') return `أنت متقدّم على الخطة ${amount}، أحسنت.`;
  if (p.kind === 'behind') return `أنت متأخر عن الخطة ${amount}، يمكنك تعويضها اليوم.`;
  return 'أنت على الموعد تماماً.';
}

function PlanActive({ plan, ask }: { plan: Plan; ask: Ask }) {
  const prog = planProgress.value!;
  const target = werdTarget.value;
  const portion = todayPortion(plan, log.value, today.value, target);
  const elapsed = daysBetween(plan.start, today.value) + 1;
  const over = elapsed > plan.days;
  const p = pace(prog.read, prog.expected, expectedBy(plan, elapsed - 1));
  const pct = Math.floor((prog.read / prog.total) * 100);

  const cancel = async () => {
    const ok = await ask({
      title: 'إلغاء خطة الختمة؟',
      body: <p>يبقى سجل قراءتك كما هو، ويعود وردك اليومي إلى هدفك ({countPages(werd.value.goal)}).</p>,
      confirm: 'إلغاء الخطة',
      cancel: 'متابعة الخطة',
      danger: true,
    });
    if (!ok) return;
    werd.value = { ...werd.value, plan: null };
    toast('أُلغيت خطة الختمة');
  };

  return (
    <section class="card werd-card werd-plan" aria-labelledby="werd-plan-title">
      <CardHead
        title={`ختمة في ${countDays(plan.days)}`}
        sub={`بدأت ${dayLabel(plan.start)}${plan.fromPage > 1 ? ` من صفحة ${arNum(plan.fromPage)}` : ''}`}
        side={
          <span class="tag tag-primary werd-day-tag">
            اليوم {arNum(prog.day)} من {arNum(prog.days)}
          </span>
        }
      />

      {portion && (
        <div class={`werd-portion${portion.next == null ? ' done' : ''}`}>
          <span class="werd-portion-kicker">ورد اليوم</span>
          <p class="werd-portion-range">
            {portion.from === portion.to
              ? `صفحة ${arNum(portion.from)}`
              : `من صفحة ${arNum(portion.from)} إلى ${arNum(portion.to)}`}
          </p>
          <p class="werd-portion-surahs">{surahRangeLabel(portion.surahs)}</p>
          <Progress value={portion.done} max={portion.size} label="تقدم ورد اليوم" />
          <div class="werd-portion-foot">
            <span>
              {portion.next == null ? (
                <>
                  <Icon name="checkCircle" size={16} /> أتممت ورد اليوم
                </>
              ) : (
                `قرأت ${arNum(portion.done)} من ${countPages(portion.size)}`
              )}
            </span>
            <a class="btn btn-sm" href={`/mushaf/${portion.next ?? portion.from}`}>
              <Icon name="book" size={16} />
              {portion.next == null ? 'افتح الورد' : portion.done ? 'واصل الورد' : 'اقرأ الورد'}
            </a>
          </div>
        </div>
      )}

      <div class="werd-plan-progress">
        <div class="werd-plan-row">
          <span>
            قرأت {arNum(prog.read)} من {countPages(prog.total)}
          </span>
          <b>{arNum(pct)}٪</b>
        </div>
        <Progress value={prog.read} max={prog.total} label="تقدم الختمة" />
        <p class={`werd-pace ${over ? 'behind' : p.kind}`}>
          <Icon name={p.kind === 'behind' || over ? 'clock' : 'checkCircle'} size={16} />
          {paceText(p, over, prog.total - prog.read)}
        </p>
      </div>

      <footer class="werd-plan-foot">
        <span class="hint">تنتهي الخطة {dayLabel(planEnd(plan))}</span>
        <button class="btn btn-sm btn-ghost" onClick={cancel}>
          <Icon name="x" size={16} /> إلغاء الخطة
        </button>
      </footer>
    </section>
  );
}

/* ── Finished ────────────────────────────────────────────────────────────── */

function PlanDone({ plan }: { plan: Plan }) {
  // Normally counted (with a toast) by the global watcher; this silent call is
  // a fallback, and settleKhatma counts each plan only once.
  useEffect(() => {
    settleKhatma(false);
  }, [plan.start, plan.fromPage, plan.days]);

  const finished = planFinishDay(plan, log.value) ?? today.value;
  const took = daysBetween(plan.start, finished) + 1;
  const total = planTotal(plan.fromPage);

  return (
    <section class="card werd-card werd-celebrate" aria-labelledby="werd-plan-title">
      <span class="werd-celebrate-badge" aria-hidden="true">
        <Icon name="award" size={34} />
      </span>
      <h2 id="werd-plan-title" class="display werd-celebrate-title">
        ختمةٌ مباركة
      </h2>
      <p>
        أتممت قراءة {plan.fromPage === 1 ? 'المصحف كاملاً' : countPages(total)} في {countDays(took)}. تقبّل الله منك.
      </p>
      <p class="werd-celebrate-ayah display">﴿رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ﴾</p>
      <div class="werd-celebrate-actions">
        <button class="btn" onClick={() => (werd.value = { ...werd.value, plan: null })}>
          <Icon name="plus" size={18} /> ابدأ ختمة جديدة
        </button>
        <span class="tag tag-accent">عدد ختماتك: {arNum(Math.max(1, stats.value.khatmas))}</span>
      </div>
    </section>
  );
}
