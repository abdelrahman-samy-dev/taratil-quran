import { signal, useSignal } from '@preact/signals';
import { memo } from 'preact/compat';
import { useEffect, useMemo } from 'preact/hooks';
import { playRadio, status, toggle, track, type Status } from '../../audio/player';
import { plural } from '../../lib/arabic';
import { persisted } from '../../lib/storage';
import { Icon } from '../../ui/Icon';
import { Empty, ErrorState, PageHeader, Segmented, Skeleton } from '../../ui/kit';
import {
  LIVE,
  baseName,
  filterStations,
  loadStations,
  picks,
  type Category,
  type Station,
} from './stations';
import './radio.css';

type Tab = Category | 'favs';
type RowState = 'idle' | Status;

const favs = persisted<string[]>('radio:favs', []);
const tab = persisted<Tab>('radio:tab', 'featured');

// The catalogue survives navigation within the session.
const catalogue = signal<Station[] | null>(null);
const catalogueError = signal(false);
let loading: Promise<void> | null = null;

function ensureCatalogue() {
  if (catalogue.value || loading) return;
  catalogueError.value = false;
  loading = loadStations()
    .then((list) => void (catalogue.value = list))
    .catch(() => void (catalogueError.value = true))
    .finally(() => (loading = null));
}

const TAB_LABELS: Record<Tab, string> = {
  featured: 'مميزة',
  favs: 'المفضلة',
  reciters: 'القراء',
  tafsir: 'التفسير',
  translations: 'الترجمات',
  misc: 'متنوعة',
};

function toggleFav(id: string) {
  const cur = favs.value;
  favs.value = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

function press(s: Station, state: RowState) {
  if (state === 'playing' || state === 'loading') toggle();
  else playRadio({ id: s.id, name: s.name, urls: s.urls });
}

export default function RadioPage() {
  const input = useSignal('');
  const q = useSignal('');

  useEffect(ensureCatalogue, []);
  useEffect(() => {
    const t = setTimeout(() => (q.value = input.value.trim()), 200);
    return () => clearTimeout(t);
  }, [input.value]);

  const all = catalogue.value;
  const favIds = favs.value;
  const hasFavs = favIds.length > 0;
  const current: Tab = tab.value === 'favs' && !hasFavs ? 'featured' : tab.value;

  // Only the row of the active station depends on the player's status.
  const t = track.value;
  const activeId = t?.kind === 'radio' ? t.id : null;
  const activeState: RowState = activeId ? status.value : 'idle';

  const everything = useMemo(() => (all ? [...LIVE, ...all] : LIVE), [all]);

  const list = useMemo(() => {
    if (q.value) return filterStations(everything, q.value);
    if (current === 'favs') return everything.filter((s) => favIds.includes(s.id));
    if (!all) return [];
    if (current === 'featured') return picks(all);
    return all.filter((s) => s.category === current);
  }, [everything, all, current, q.value, favIds]);

  const tabs: Tab[] = hasFavs
    ? ['featured', 'favs', 'reciters', 'tafsir', 'translations', 'misc']
    : ['featured', 'reciters', 'tafsir', 'translations', 'misc'];

  const searching = !!q.value;

  return (
    <div class="rd-page">
      <PageHeader title="إذاعات القرآن الكريم" subtitle="بث مباشر وإذاعات متواصلة لكبار القراء والتفسير والترجمات" />

      {!searching && (
        <section aria-labelledby="rd-live-title">
          <h2 id="rd-live-title" class="section-title rd-live-heading">
            <span>
              <span class="live-dot" aria-hidden="true" /> بث مباشر
            </span>
          </h2>
          <div class="rd-live-grid">
            {LIVE.map((s) => (
              <LiveCard
                key={s.id}
                station={s}
                state={s.id === activeId ? activeState : 'idle'}
                fav={favIds.includes(s.id)}
              />
            ))}
          </div>
        </section>
      )}

      <div class="rd-tools">
        <label class="search-field">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={input.value}
            onInput={(e) => (input.value = e.currentTarget.value)}
            placeholder="ابحث باسم القارئ أو الإذاعة"
            aria-label="البحث في الإذاعات"
            enterKeyHint="search"
          />
          {input.value && (
            <button class="icon-btn rd-clear" onClick={() => (input.value = '')} aria-label="مسح البحث">
              <Icon name="x" size={16} />
            </button>
          )}
        </label>
        {!searching && (
          <Segmented<Tab>
            value={current}
            onChange={(v) => (tab.value = v)}
            options={tabs.map((v) => ({ value: v, label: TAB_LABELS[v] }))}
            label="تصنيف الإذاعات"
            scroll
          />
        )}
      </div>

      {searching && (
        <p class="rd-count" role="status" aria-live="polite">
          {list.length ? plural(list.length, 'إذاعة واحدة', 'إذاعتان', 'إذاعات', 'إذاعة') : ''}
        </p>
      )}

      {!all && !catalogueError.value && current !== 'favs' && !searching ? (
        <Skeleton lines={6} class="rd-skeleton" />
      ) : catalogueError.value && !all && current !== 'favs' ? (
        <ErrorState
          text="تعذر تحميل قائمة الإذاعات. البث المباشر أعلاه متاح."
          onRetry={() => {
            loading = null;
            ensureCatalogue();
          }}
        />
      ) : list.length ? (
        <ul class="rd-list">
          {list.map((s) => (
            <li key={s.id}>
              <StationRow station={s} state={s.id === activeId ? activeState : 'idle'} fav={favIds.includes(s.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={searching ? 'search' : 'star'} title={searching ? 'لا توجد إذاعة بهذا الاسم' : 'لا توجد إذاعات هنا بعد'}>
          {searching && <p class="hint">جرّب جزءًا من الاسم فقط، مثل «المنشاوي» أو «تفسير».</p>}
        </Empty>
      )}
    </div>
  );
}

function stateText(state: RowState, fallback: string): string {
  switch (state) {
    case 'loading':
      return 'جارٍ الاتصال…';
    case 'playing':
      return 'يُبث الآن';
    case 'paused':
      return 'متوقف مؤقتًا';
    case 'error':
      return 'تعذر التشغيل، اضغط للمحاولة مجددًا';
    default:
      return fallback;
  }
}

function PlayGlyph({ state, size = 20 }: { state: RowState; size?: number }) {
  if (state === 'playing') {
    return (
      <span class="rd-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    );
  }
  if (state === 'error') return <Icon name="refresh" size={size} />;
  if (state === 'loading') return <Icon name="pause" size={size} />;
  return <Icon name="play" size={size} />;
}

function actionLabel(state: RowState, name: string): string {
  if (state === 'playing' || state === 'loading') return `إيقاف ${name}`;
  if (state === 'error') return `إعادة محاولة تشغيل ${name}`;
  return `تشغيل ${name}`;
}

const FavButton = ({ station, fav }: { station: Station; fav: boolean }) => (
  <button
    class={`icon-btn fav rd-fav${fav ? ' on' : ''}`}
    onClick={() => toggleFav(station.id)}
    aria-pressed={fav}
    aria-label={fav ? `إزالة ${station.name} من المفضلة` : `إضافة ${station.name} إلى المفضلة`}
  >
    <Icon name="star" size={19} fill={fav} />
  </button>
);

const LiveCard = memo(function LiveCard({ station: s, state, fav }: { station: Station; state: RowState; fav: boolean }) {
  const live = s.live!;
  return (
    <div class={`rd-live card is-${state}`}>
      <button class="rd-live-main" onClick={() => press(s, state)} aria-label={actionLabel(state, s.name)}>
        <span class="rd-live-badge">
          <span class="live-dot" aria-hidden="true" />
          {state === 'idle' ? 'بث مباشر' : stateText(state, '')}
        </span>
        <span class="rd-live-title">{live.title}</span>
        <span class="rd-live-place">
          <Icon name="mapPin" size={14} /> {live.place}
          {live.place.includes(live.country) ? '' : ` · ${live.country}`}
        </span>
        <span class={`rd-play lg${state === 'loading' ? ' loading' : ''}`} aria-hidden="true">
          <PlayGlyph state={state} size={22} />
        </span>
      </button>
      <FavButton station={s} fav={fav} />
    </div>
  );
});

const StationRow = memo(function StationRow({ station: s, state, fav }: { station: Station; state: RowState; fav: boolean }) {
  const sub = s.live ? `بث مباشر · ${s.live.country}` : (s.subtitle ?? 'بث متواصل');
  return (
    <div class={`rd-row is-${state}`}>
      <button class="rd-row-main" onClick={() => press(s, state)} aria-label={actionLabel(state, s.name)}>
        <span class={`rd-play${state === 'loading' ? ' loading' : ''}`} aria-hidden="true">
          <PlayGlyph state={state} size={18} />
        </span>
        <span class="rd-row-text">
          <span class="rd-name">{baseName(s)}</span>
          <span class="rd-sub">{stateText(state, sub)}</span>
        </span>
      </button>
      <FavButton station={s} fav={fav} />
    </div>
  );
});
