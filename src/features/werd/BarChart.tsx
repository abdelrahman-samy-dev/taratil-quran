import { useEffect, useRef, useState } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { countPages, dayLabel } from './logic';

interface Props {
  data: { key: string; pages: number }[];
  goal: number;
  today: string;
  /** Accessible name of the chart, e.g. "الصفحات المقروءة في آخر ٧ أيام". */
  label: string;
}

const H = 196;
const TOP = 24;
const BOTTOM = 30;
const SIDE = 4;

const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'narrow' });

function dayDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Pages-per-day bars drawn at the container's real pixel width (text stays
 * crisp at any size). Oldest day on the right, today on the left (RTL time).
 * Screen readers get a summary label and a hidden data table.
 */
export function BarChart({ data, goal, today, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const dense = n > 10;
  const max = Math.max(goal, 1, ...data.map((d) => d.pages)) * 1.14;
  const plotH = H - TOP - BOTTOM;
  const slot = w > 0 ? (w - SIDE * 2) / n : 0;
  const barW = Math.max(3, Math.min(dense ? slot * 0.66 : slot * 0.56, 40));
  const y = (v: number) => TOP + plotH * (1 - v / max);
  const goalY = y(goal);
  const total = data.reduce((s, d) => s + d.pages, 0);

  return (
    <figure class="wc">
      <div class="wc-plot" ref={box} style={{ height: `${H}px` }}>
        {w > 0 && (
          <svg
            width={w}
            height={H}
            viewBox={`0 0 ${w} ${H}`}
            role="img"
            aria-label={`${label}: ${countPages(total)} إجمالاً`}
          >
            <line class="wc-base" x1={SIDE} x2={w - SIDE} y1={TOP + plotH + 0.5} y2={TOP + plotH + 0.5} />
            {data.map((d, i) => {
              // i = 0 is the oldest day → right edge.
              const cx = w - SIDE - slot * (i + 0.5);
              const h = d.pages > 0 ? Math.max(4, plotH * (d.pages / max)) : 3;
              const isToday = d.key === today;
              const cls = isToday ? 'today' : d.pages === 0 ? 'zero' : d.pages >= goal ? 'met' : '';
              const showLabel = !dense || isToday || (n - 1 - i) % 5 === 0;
              return (
                <g key={d.key}>
                  <rect
                    class={`wc-bar ${cls}`}
                    x={cx - barW / 2}
                    y={TOP + plotH - h}
                    width={barW}
                    height={h}
                    rx={Math.min(4, barW / 2)}
                  />
                  {!dense && d.pages > 0 && (
                    <text class="wc-val" x={cx} y={TOP + plotH - h - 6} text-anchor="middle">
                      {arNum(d.pages)}
                    </text>
                  )}
                  {showLabel && (
                    <text class={`wc-label${isToday ? ' today' : ''}`} x={cx} y={H - 9} text-anchor="middle">
                      {isToday ? 'اليوم' : dense ? arNum(dayDate(d.key).getDate()) : weekday.format(dayDate(d.key))}
                    </text>
                  )}
                  {/* Full-height hit area for the native tooltip. */}
                  <rect class="wc-hit" x={cx - slot / 2} y={TOP - 8} width={slot} height={plotH + 8}>
                    <title>{`${dayLabel(d.key)}: ${countPages(d.pages)}`}</title>
                  </rect>
                </g>
              );
            })}
            <line class="wc-goal" x1={SIDE} x2={w - SIDE} y1={goalY} y2={goalY} />
          </svg>
        )}
      </div>
      <table class="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">اليوم</th>
            <th scope="col">الصفحات</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.key === today ? 'اليوم' : dayLabel(d.key)}</th>
              <td>{arNum(d.pages)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
