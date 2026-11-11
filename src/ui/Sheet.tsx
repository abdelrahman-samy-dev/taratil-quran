import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ComponentChildren;
  /** 'sheet' slides up on phones and centres on desktop; 'full' takes the screen. */
  variant?: 'sheet' | 'full';
  class?: string;
}

const stack: (() => void)[] = [];
/** Set when we call history.back() ourselves, so other open sheets ignore that popstate. */
let selfPop = false;

/** Accessible modal: focus trap, Esc / back button to close, scroll lock. */
export function Sheet({ open, onClose, title, children, variant = 'sheet', class: cls }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const close = () => closeRef.current();
    stack.push(close);
    document.documentElement.classList.add('modal-open');
    // Let the hardware back button close the sheet instead of leaving the page.
    const openedAt = location.href;
    history.pushState({ ...(history.state ?? {}), sheet: true }, '');
    let poppedByUs = false;
    const onPop = () => {
      if (selfPop) {
        selfPop = false;
        return;
      }
      if (stack[stack.length - 1] !== close) return; // only the top sheet reacts to Back
      poppedByUs = true;
      close();
    };
    window.addEventListener('popstate', onPop);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === close) {
        e.stopPropagation();
        close();
      }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>('[autofocus]') ?? panel.current;
      target?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      const i = stack.indexOf(close);
      if (i >= 0) stack.splice(i, 1);
      if (!stack.length) document.documentElement.classList.remove('modal-open');
      if (!poppedByUs && history.state?.sheet) {
        // If the page changed its URL while the sheet was open (e.g. the mushaf moved to
        // another page), going back would restore the old URL — keep the new one instead.
        if (location.href === openedAt) {
          selfPop = stack.length > 0;
          history.back();
        }
        else history.replaceState(null, '', location.href);
      }
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div class={`sheet-root sheet-${variant}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        class={`sheet-panel${cls ? ` ${cls}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        {variant === 'sheet' && <div class="sheet-handle" aria-hidden="true" />}
        {title && (
          <div class="sheet-head">
            <h2 class="sheet-title">{title}</h2>
            <button class="icon-btn" onClick={onClose} aria-label="إغلاق">
              <Icon name="x" size={20} />
            </button>
          </div>
        )}
        <div class="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
