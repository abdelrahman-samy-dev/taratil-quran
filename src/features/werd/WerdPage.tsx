import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { chapterAtPage, TOTAL_PAGES } from '../../quran/data';
import {
  bestStreak,
  lastDays,
  lastRead,
  log,
  stats,
  streak,
  today,
  todayLog,
  werd,
  werdTarget,
} from '../../state/progress';
import { Icon } from '../../ui/Icon';
import { PageHeader, Ring, Segmented, Stat } from '../../ui/kit';
import { ChoiceGroup, useConfirm } from '../settings/controls';
import { initAchievements } from './achievements';
import { BadgesCard } from './BadgesCard';
import { BarChart } from './BarChart';
import { BookmarksCard } from './BookmarksCard';
import { GOAL_PRESETS, arDecimal, clampInt, countDays, countPages, dayWord, totals } from './logic';
import { PlanCard } from './PlanCard';
import './werd.css';

export default function WerdPage() {
  const [ask, confirmSheet] = useConfirm();
  // main.tsx starts the watcher; this is a no-op then, and a fallback otherwise.
  useEffect(() => void initAchievements(), []);

  return (
    <div class="werd">
      <PageHeader title="الورد والإنجازات" subtitle="قراءتك اليومية، خطة الختمة، وما حققته حتى الآن" />

      <div class="werd-top">
        <TodayCard />
        <StatsGrid />
      </div>

      <div class="werd-row">
        <PlanCard ask={ask} />
        <div class="werd-side">
          <GoalCard />
          <ChartCard />
        </div>
      </div>

      <BadgesCard />
      <BookmarksCard />
      {confirmSheet}
    </div>
  );
}

/* ── Today ───────────────────────────────────────────────────────────────── */

function TodayCard() {
  const read = todayLog.value.pages.length;
  const target = werdTarget.value;
  const done = read >= target;
  const left = target - read;
  const page = lastRead.value.page;
  const s = streak.value;
  const best = bestStreak.value;

  const status = done
    ? 'أتممت وردك اليوم، تقبّل الله منك.'
    : read === 0
      ? `وردك اليوم ${countPages(target)}، ابدأ ولو بصفحة.`
      : `بقي لك ${countPages(left)} لإتمام وردك.`;

  return (
    <section class={`card werd-today${done ? ' done' : ''}`} aria-labelledby="werd-today-title">
      <div class="werd-today-main">
        <div class="werd-ring" role="img" aria-label={`قرأت ${arNum(read)} من ${countPages(target)} اليوم`}>
          <Ring value={read} max={target} size={132} stroke={11}>
            <span class="werd-ring-num">{arNum(read)}</span>
            <span class="werd-ring-of">من {arNum(target)}</span>
          </Ring>
        </div>
        <div class="werd-today-text">
          <h2 id="werd-today-title" class="werd-today-title display">
            وِرد اليوم
          </h2>
          <p class="werd-today-status">
            {done && <Icon name="checkCircle" size={18} />}
            {status}
          </p>
          <a class="btn werd-continue" href={`/mushaf/${page}`}>
            <Icon name="book" size={18} /> واصل القراءة
          </a>
          <span class="werd-continue-hint">
            سورة {chapterAtPage(page).ar} · صفحة {arNum(page)}
          </span>
        </div>
      </div>

      <div class="werd-streaks">
        <div class={`werd-streak${s > 0 ? ' hot' : ''}`}>
          <span class="werd-streak-icon" aria-hidden="true">
            <Icon name="flame" size={20} />
          </span>
          <span class="werd-streak-text">
            <span class="werd-streak-num">
              {arNum(s)} <small>{dayWord(s)}</small>
            </span>
            <span class="werd-streak-label">{s > 0 ? 'السلسلة الحالية' : 'ابدأ سلسلتك اليوم'}</span>
          </span>
        </div>
        <div class="werd-streak">
          <span class="werd-streak-icon best" aria-hidden="true">
            <Icon name="award" size={20} />
          </span>
          <span class="werd-streak-text">
            <span class="werd-streak-num">
              {arNum(best)} <small>{dayWord(best)}</small>
            </span>
            <span class="werd-streak-label">أفضل سلسلة</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function StatsGrid() {
  const t = totals(log.value);
  return (
    <section class="werd-stats" aria-label="إحصاءات">
      <Stat icon="book" label="صفحة مقروءة" value={t.pages} />
      <Stat icon="headphones" label="دقيقة استماع" value={Math.round(t.listenSec / 60)} />
      <Stat icon="sun" label="أذكار مكتملة" value={t.azkarDone} />
      <Stat icon="award" label="ختمة" value={stats.value.khatmas} />
    </section>
  );
}

/* ── Daily goal ──────────────────────────────────────────────────────────── */

function GoalCard() {
  const goal = werd.value.goal;
  const plan = werd.value.plan;
  const custom = useSignal(!(GOAL_PRESETS as readonly number[]).includes(goal));
  const setGoal = (g: number) => (werd.value = { ...werd.value, goal: clampInt(g, 1, TOTAL_PAGES) });

  return (
    <section class="card werd-card" aria-labelledby="werd-goal-title">
      <header class="werd-card-head">
        <span class="werd-card-icon" aria-hidden="true">
          <Icon name="target" size={20} />
        </span>
        <div class="werd-card-titles">
          <h2 id="werd-goal-title">الهدف اليومي</h2>
          <p class="hint">عدد الصفحات التي تنوي قراءتها كل يوم</p>
        </div>
      </header>

      <ChoiceGroup
        name="werd-goal"
        class="werd-goal-choice"
        legend="عدد الصفحات يومياً"
        hideLegend
        value={custom.value ? 0 : goal}
        options={[...GOAL_PRESETS.map((g) => ({ value: g as number, label: arNum(g) })), { value: 0, label: 'مخصص' }]}
        onChange={(v) => {
          custom.value = v === 0;
          if (v) setGoal(v);
        }}
      />
      {custom.value && (
        <label class="werd-inline-input">
          <span>عدد الصفحات</span>
          <input
            class="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={TOTAL_PAGES}
            value={goal}
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              if (v >= 1) setGoal(v);
            }}
          />
        </label>
      )}

      <p class="werd-goal-note">
        {countPages(goal)} يومياً تختم بها المصحف كل {countDays(Math.ceil(TOTAL_PAGES / goal))} تقريباً.
      </p>
      {plan && (
        <p class="werd-goal-plan">
          <Icon name="info" size={16} />
          <span>
            خطة الختمة تحدد وردك الآن ({countPages(werdTarget.value)} يومياً)، ويعود هذا الهدف عند انتهائها أو إلغائها.
          </span>
        </p>
      )}
    </section>
  );
}

/* ── Chart ───────────────────────────────────────────────────────────────── */

function ChartCard() {
  const range = useSignal<'7' | '30'>('7');
  const n = Number(range.value);
  const data = lastDays(n);
  const target = werdTarget.value;
  const total = data.reduce((s, d) => s + d.pages, 0);
  const met = data.filter((d) => d.pages >= target).length;
  const label = n === 7 ? 'الصفحات المقروءة في آخر ٧ أيام' : 'الصفحات المقروءة في آخر ٣٠ يوماً';

  return (
    <section class="card werd-card werd-chart" aria-labelledby="werd-chart-title">
      <header class="werd-card-head">
        <div class="werd-card-titles">
          <h2 id="werd-chart-title">القراءة اليومية</h2>
        </div>
        <Segmented
          label="المدة"
          value={range.value}
          onChange={(v) => (range.value = v)}
          options={[
            { value: '7', label: '٧ أيام' },
            { value: '30', label: '٣٠ يوماً' },
          ]}
        />
      </header>

      <BarChart data={data} goal={target} today={today.value} label={label} />

      <ul class="werd-legend" aria-hidden="true">
        <li>
          <i class="sw today" /> اليوم
        </li>
        <li>
          <i class="sw met" /> بلغ الهدف
        </li>
        <li>
          <i class="sw goal" /> الهدف ({arNum(target)})
        </li>
      </ul>

      <dl class="werd-chart-sum">
        <div>
          <dt>المجموع</dt>
          <dd>{countPages(total)}</dd>
        </div>
        <div>
          <dt>المتوسط اليومي</dt>
          <dd>{arDecimal(total / n)}</dd>
        </div>
        <div>
          <dt>أيام بلغت الهدف</dt>
          <dd>
            {arNum(met)} من {arNum(n)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
