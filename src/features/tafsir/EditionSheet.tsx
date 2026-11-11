import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { EDITIONS } from './editions';

interface Props {
  open: boolean;
  current: string;
  onClose: () => void;
  onPick: (id: string) => void;
}

export function EditionSheet({ open, current, onClose, onPick }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="اختر كتاب التفسير">
      <ul class="tf-editions" role="radiogroup" aria-label="كتب التفسير">
        {EDITIONS.map((e) => {
          const on = e.id === current;
          return (
            <li key={e.id}>
              <button
                class={`tf-edition-opt${on ? ' on' : ''}`}
                role="radio"
                aria-checked={on}
                onClick={() => onPick(e.id)}
                autofocus={on}
              >
                <span class="tf-edition-text">
                  <span class="tf-edition-name">{e.name}</span>
                  <span class="tf-edition-desc">{e.desc}</span>
                </span>
                {on && <Icon name="check" size={20} />}
              </button>
            </li>
          );
        })}
      </ul>
      <p class="hint tf-editions-note">يُحمَّل التفسير من الإنترنت أول مرة، ثم يبقى متاحًا دون اتصال.</p>
    </Sheet>
  );
}
