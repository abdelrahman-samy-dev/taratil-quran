/**
 * Small form controls shared by the settings and werd screens:
 * radio chips/cards built on native radios, a labelled slider and a
 * promise-based confirmation sheet.
 */
import type { ComponentChildren, VNode } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { Sheet } from '../../ui/Sheet';
import './controls.css';

/* ── Radio group ─────────────────────────────────────────────────────────── */

export interface Choice<T> {
  value: T;
  label: ComponentChildren;
  /** Extra visual (swatch / preview) rendered above the label in card mode. */
  art?: ComponentChildren;
  hint?: ComponentChildren;
  disabled?: boolean;
}

/**
 * Native radio inputs styled as chips (default) or cards, so arrow keys,
 * focus and screen readers behave as expected.
 */
export function ChoiceGroup<T extends string | number>({
  name,
  legend,
  hideLegend,
  value,
  options,
  onChange,
  variant = 'chips',
  class: cls,
}: {
  name: string;
  legend: string;
  hideLegend?: boolean;
  value: T;
  options: Choice<T>[];
  onChange: (v: T) => void;
  variant?: 'chips' | 'cards';
  class?: string;
}) {
  return (
    <fieldset class={`choice choice-${variant}${cls ? ` ${cls}` : ''}`}>
      <legend class={hideLegend ? 'sr-only' : 'choice-legend'}>{legend}</legend>
      <div class="choice-row">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label key={String(o.value)} class={`choice-item${on ? ' on' : ''}${o.disabled ? ' disabled' : ''}`}>
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={on}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
              />
              {o.art && (
                <span class="choice-art" aria-hidden="true">
                  {o.art}
                </span>
              )}
              <span class="choice-label">{o.label}</span>
              {o.hint && <span class="choice-hint">{o.hint}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ── Slider ──────────────────────────────────────────────────────────────── */

export function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onInput,
  hint,
  id,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Human value shown next to the label (also used as aria-valuetext). */
  display: string;
  onInput: (v: number) => void;
  hint?: string;
  id: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div class="slider">
      <div class="slider-head">
        <label class="setting-label" for={id}>
          {label}
        </label>
        <output class="slider-value" for={id}>
          {display}
        </output>
      </div>
      {hint && <p class="setting-hint">{hint}</p>}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        style={{ '--pct': `${pct}%` }}
        onInput={(e) => onInput(Number(e.currentTarget.value))}
      />
    </div>
  );
}

/* ── Confirmation sheet ──────────────────────────────────────────────────── */

export interface ConfirmOptions {
  title: string;
  body?: ComponentChildren;
  confirm: string;
  cancel?: string;
  danger?: boolean;
}

export type Ask = (o: ConfirmOptions) => Promise<boolean>;

/**
 * Promise-based confirmation sheet, rendered by the calling page:
 *   const [ask, confirmSheet] = useConfirm();
 *   if (await ask({ title, confirm })) …
 */
export function useConfirm(): [Ask, VNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((o) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(o);
    });
  }, []);

  const close = (v: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setOpts(null);
    r?.(v);
  };

  const el = (
    <Sheet open={!!opts} onClose={() => close(false)} title={opts?.title}>
      {opts && (
        <div class="confirm">
          {opts.body && <div class="confirm-body">{opts.body}</div>}
          <div class="confirm-actions">
            {/* Destructive actions start focused on the safe choice. */}
            <button
              class={`btn${opts.danger ? ' btn-danger-solid' : ''}`}
              onClick={() => close(true)}
              autofocus={!opts.danger}
            >
              {opts.confirm}
            </button>
            <button class="btn btn-ghost" onClick={() => close(false)} autofocus={opts.danger}>
              {opts.cancel ?? 'تراجع'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
  return [ask, el];
}
