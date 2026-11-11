import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { loopAyah, playSurah, track } from '../../audio/player';
import { arNum } from '../../lib/arabic';
import { copyText, shareText } from '../../lib/device';
import { fetchJSON } from '../../lib/net';
import { chapter, parseKey, surahText } from '../../quran/data';
import { bookmarks } from '../../state/progress';
import { Icon } from '../../ui/Icon';
import { navigateAfterSheets, Sheet } from '../../ui/Sheet';
import { useLocation } from 'preact-iso';
import { toast } from '../../ui/toast';

const LABELS = ['حفظ', 'تدبر', 'مراجعة', 'عام'];

interface Props {
  ayahKey: string | null;
  page: number;
  onClose: () => void;
}

export function AyahSheet({ ayahKey, page, onClose }: Props) {
  const { route } = useLocation();
  const text = useSignal('');
  const tafsir = useSignal<string | null>(null);
  const tafsirFailed = useSignal(false);
  const open = !!ayahKey;
  const [s, a] = ayahKey ? parseKey(ayahKey) : [1, 1];
  const c = chapter(s);

  useEffect(() => {
    if (!ayahKey) return;
    let alive = true;
    text.value = '';
    tafsir.value = null;
    tafsirFailed.value = false;
    surahText(s)
      .then((d) => alive && (text.value = d.v[a - 1] ?? ''))
      .catch(() => {});
    fetchJSON<{ data: { text: string } }>(`https://api.alquran.cloud/v1/ayah/${s}:${a}/ar.muyassar`, { retries: 1 })
      .then((r) => alive && (tafsir.value = r.data.text))
      .catch(() => alive && (tafsirFailed.value = true));
    return () => {
      alive = false;
    };
  }, [ayahKey]);

  const ref = `[${c.ar}: ${arNum(a)}]`;
  const marked = bookmarks.value.find((b) => b.key === ayahKey);

  const toggleMark = (label: string) => {
    if (!ayahKey) return;
    if (marked && marked.label === label) {
      bookmarks.value = bookmarks.value.filter((b) => b.key !== ayahKey);
      toast('أُزيلت العلامة');
      return;
    }
    bookmarks.value = [
      { id: `b${Date.now()}`, page, key: ayahKey, label, at: Date.now() },
      ...bookmarks.value.filter((b) => b.key !== ayahKey),
    ];
    toast(`حُفظت في «${label}»`);
  };

  const playingThisSurah = track.value?.kind === 'surah' && track.value.surah === s;

  return (
    <Sheet open={open} onClose={onClose} title={`سورة ${c.ar} · الآية ${arNum(a)}`}>
      <div class="ayah-sheet">
        <p class="ayah-sheet-text quran-text">
          {text.value || '…'} <span class="ayah-num">{arNum(a)}</span>
        </p>

        <div class="ayah-actions">
          <button
            class="ayah-action"
            onClick={() => {
              void playSurah(s, { ayah: a });
              onClose();
            }}
          >
            <Icon name="play" size={18} />
            <span>استمع من هنا</span>
          </button>
          <button
            class="ayah-action"
            onClick={() => {
              if (playingThisSurah) loopAyah(a, 3, s);
              else void playSurah(s, { ayah: a }).then((ok) => ok && loopAyah(a, 3, s));
              onClose();
            }}
          >
            <Icon name="repeatOne" size={18} />
            <span>كرّر ٣ مرات</span>
          </button>
          <button class="ayah-action" onClick={() => copyText(`﴿${text.value}﴾ ${ref}`, 'نُسخت الآية')}>
            <Icon name="copy" size={18} />
            <span>نسخ</span>
          </button>
          <button class="ayah-action" onClick={() => shareText(`﴿${text.value}﴾ ${ref}`)}>
            <Icon name="share" size={18} />
            <span>مشاركة</span>
          </button>
        </div>

        <div class="ayah-marks" role="group" aria-label="حفظ علامة">
          <Icon name={marked ? 'bookmarkFill' : 'bookmark'} size={18} class="ayah-marks-icon" />
          {LABELS.map((l) => (
            <button
              key={l}
              class={`chip${marked?.label === l ? ' active' : ''}`}
              onClick={() => toggleMark(l)}
              aria-pressed={marked?.label === l}
            >
              {l}
            </button>
          ))}
        </div>

        <section class="ayah-tafsir">
          <h3>التفسير الميسّر</h3>
          {tafsir.value ? (
            <p>{tafsir.value}</p>
          ) : tafsirFailed.value ? (
            <p class="muted">التفسير غير متاح الآن (يحتاج اتصالاً بالإنترنت أول مرة).</p>
          ) : (
            <div class="skeleton-block">
              <div class="skeleton-line" />
              <div class="skeleton-line" style={{ width: '70%' }} />
            </div>
          )}
          <button
            class="btn btn-ghost btn-sm"
            onClick={() => {
              onClose();
              navigateAfterSheets(() => route(`/tafsir/${s}?a=${a}`));
            }}
          >
            تفاسير أخرى للآية
          </button>
        </section>
      </div>
    </Sheet>
  );
}
