import { useEffect, useState } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { type CityResult, GEO_MESSAGES, GeoError, cityToLocation, locateMe, placeLabel, searchCities } from './geo';
import { isDefaultLocation, prayerLocation, setLocation } from './prayer-state';

type SearchState = { status: 'idle' | 'loading' | 'done' | 'error'; results: CityResult[] };

/** Pick the place used for prayer times and the Qibla: GPS or city search. */
export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle', results: [] });
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSearch({ status: 'idle', results: [] });
      setGeoError('');
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearch({ status: 'idle', results: [] });
      return;
    }
    setSearch((s) => ({ status: 'loading', results: s.results }));
    const c = new AbortController();
    const timer = setTimeout(() => {
      searchCities(q, c.signal)
        .then((results) => !c.signal.aborted && setSearch({ status: 'done', results }))
        .catch(() => !c.signal.aborted && setSearch({ status: 'error', results: [] }));
    }, 350);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query, retry]);

  const useGps = async () => {
    setLocating(true);
    setGeoError('');
    try {
      const loc = await locateMe();
      setLocation(loc);
      toast(`تم ضبط الموقع: ${loc.name}`);
      onClose();
    } catch (err) {
      setGeoError(GEO_MESSAGES[err instanceof GeoError ? err.code : 'unavailable']);
    } finally {
      setLocating(false);
    }
  };

  const choose = (r: CityResult) => {
    const loc = cityToLocation(r);
    setLocation(loc);
    toast(`تم ضبط الموقع: ${loc.name}`);
    onClose();
  };

  const current = prayerLocation.value;

  return (
    <Sheet open={open} onClose={onClose} title="موقع المواقيت" class="pr-loc-sheet">
      <p class="pr-loc-current">
        <Icon name="mapPin" size={18} />
        <span>
          الموقع الحالي: <strong>{placeLabel(current)}</strong>
          {isDefaultLocation.value && <span class="tag tag-accent">افتراضي</span>}
        </span>
      </p>

      <button class="btn btn-block" onClick={useGps} disabled={locating} aria-busy={locating}>
        <Icon name="locate" size={20} class={locating ? 'pr-spin' : undefined} />
        {locating ? 'جارٍ تحديد موقعك…' : 'استخدم موقعي'}
      </button>
      {geoError && (
        <p class="pr-loc-error" role="alert">
          {geoError}
        </p>
      )}

      <div class="pr-loc-or" aria-hidden="true">
        <span>أو ابحث عن مدينة</span>
      </div>

      <label class="search-field">
        <Icon name="search" size={20} />
        <span class="sr-only">اسم المدينة</span>
        <input
          type="search"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="اسم المدينة، مثل: المنصورة"
          enterKeyHint="search"
          autoComplete="off"
          spellcheck={false}
        />
        {query && (
          <button class="icon-btn" onClick={() => setQuery('')} aria-label="مسح البحث">
            <Icon name="x" size={18} />
          </button>
        )}
      </label>

      <div class="pr-loc-results" aria-live="polite" aria-busy={search.status === 'loading'}>
        {search.status === 'idle' && <p class="hint pr-loc-hint">اكتب حرفين على الأقل. يمكنك الكتابة بالعربية أو الإنجليزية.</p>}
        {search.status === 'loading' && !search.results.length && (
          <div class="pr-loc-skeleton" aria-label="جارٍ البحث">
            {[0, 1, 2].map((i) => (
              <div key={i} class="skeleton-line" style={{ width: `${80 - i * 15}%` }} />
            ))}
          </div>
        )}
        {search.status === 'error' && (
          <div class="pr-loc-msg">
            <p>تعذّر البحث. تحقق من الاتصال بالإنترنت.</p>
            <button class="btn btn-sm btn-ghost" onClick={() => setRetry((n) => n + 1)}>
              <Icon name="refresh" size={16} /> إعادة المحاولة
            </button>
          </div>
        )}
        {search.status === 'done' && !search.results.length && (
          <p class="pr-loc-msg">لا نتائج. جرّب كتابة الاسم بطريقة أخرى أو بالإنجليزية.</p>
        )}
        {search.results.length > 0 && search.status !== 'error' && (
          <ul class="picker-list" aria-label="نتائج البحث">
            {search.results.map((r) => (
              <li key={r.id} class="picker-item">
                <button class="picker-main pr-loc-item" onClick={() => choose(r)}>
                  <span class="picker-name">{r.name}</span>
                  <span class="picker-meta">
                    {[r.admin1, r.country].filter(Boolean).join('، ') || `${arNum(r.latitude.toFixed(2))}، ${arNum(r.longitude.toFixed(2))}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
