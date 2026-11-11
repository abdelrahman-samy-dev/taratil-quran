import { signal } from '@preact/signals';

interface ToastItem {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

const items = signal<ToastItem[]>([]);
let seq = 0;

export function toast(text: string, action?: ToastItem['action'], ms = 2600): void {
  const id = ++seq;
  items.value = [...items.value.slice(-2), { id, text, action }];
  if (ms > 0) setTimeout(() => dismiss(id), ms);
}

function dismiss(id: number) {
  items.value = items.value.filter((t) => t.id !== id);
}

export function Toaster() {
  return (
    <div class="toaster" role="status" aria-live="polite">
      {items.value.map((t) => (
        <div key={t.id} class="toast">
          <span>{t.text}</span>
          {t.action && (
            <button
              class="toast-action"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
