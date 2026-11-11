import type { ComponentChildren, JSX } from 'preact';
import { arNum } from '../lib/arabic';
import { Icon, type IconName } from './Icon';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ComponentChildren;
  actions?: ComponentChildren;
}) {
  return (
    <header class="page-head">
      <div>
        <h1 class="page-title">{title}</h1>
        {subtitle && <p class="page-sub">{subtitle}</p>}
      </div>
      {actions && <div class="page-actions">{actions}</div>}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  scroll,
}: {
  value: T;
  options: { value: T; label: ComponentChildren }[];
  onChange: (v: T) => void;
  label: string;
  scroll?: boolean;
}) {
  return (
    <div class={`segmented${scroll ? ' scroll' : ''}`} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          class={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label class="setting-row">
      <span class="setting-text">
        <span class="setting-label">{label}</span>
        {hint && <span class="setting-hint">{hint}</span>}
      </span>
      <input type="checkbox" class="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
    </label>
  );
}

export function Empty({ icon = 'info', title, children }: { icon?: IconName; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <span class="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <p class="empty-title">{title}</p>
      {children && <div class="empty-body">{children}</div>}
    </div>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div class="empty error">
      <span class="empty-icon">
        <Icon name="wifiOff" size={28} />
      </span>
      <p class="empty-title">{text}</p>
      {onRetry && (
        <button class="btn" onClick={onRetry}>
          <Icon name="refresh" size={18} /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3, class: cls }: { lines?: number; class?: string }) {
  return (
    <div class={`skeleton-block${cls ? ` ${cls}` : ''}`} aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} class="skeleton-line" style={{ width: `${100 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

/** Circular progress ring (azkar counters, werd). */
export function Ring({
  value,
  max,
  size = 64,
  stroke = 6,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ComponentChildren;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <span class="ring" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle class="ring-bg" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} fill="none" />
        <circle
          class="ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke-width={stroke}
          fill="none"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - pct)}
          stroke-linecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span class="ring-label">{children}</span>
    </span>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div class="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div class="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ icon, label, value, hint }: { icon: IconName; label: string; value: number | string; hint?: string }) {
  return (
    <div class="stat card">
      <span class="stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <span class="stat-value">{typeof value === 'number' ? arNum(value) : value}</span>
      <span class="stat-label">{label}</span>
      {hint && <span class="stat-hint">{hint}</span>}
    </div>
  );
}

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const { class: cls, ...rest } = props;
  return <div class={`card${cls ? ` ${cls}` : ''}`} {...rest} />;
}
