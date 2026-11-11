import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import { downloadState, downloadSurah, removeDownload } from '../../audio/offline';
import {
  currentAyah,
  fullPlayerOpen,
  isPlaying,
  lastSession,
  playSurah,
  resumeLast,
  status,
  toggle,
  track,
} from '../../audio/player';
import { ReciterPicker } from '../../audio/ReciterPicker';
import {
  findRecitation,
  loadRecitations,
  recitations,
  recitationsError,
  styleLabel,
  surahUrl,
} from '../../audio/reciters';
import { arNum, normalizeArabic, parseArNum } from '../../lib/arabic';
import { clock } from '../../lib/format';
import { chapter, chapters, placeLabel } from '../../quran/data';
import { prefs, setPref } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { ErrorState, PageHeader, Segmented } from '../../ui/kit';
import './listen.css';

const searchIndex = chapters.map((c) => normalizeArabic(`${c.ar} ${c.en}`));
type Filter = 'all' | 'makkah' | 'madinah' | 'offline';

export default function ListenPage() {
  const pick = useSignal(false);
  const q = useSignal('');
  const filter = useSignal<Filter>('all');

  useEffect(() => {
    void loadRecitations().catch(() => {});
  }, []);

  const rec = findRecitation(prefs.value.reciter);
  const t = track.value;
  const playingSurah = t?.kind === 'surah' && t.recitation.id === rec?.id ? t.surah : 0;

  const list = useMemo(() => {
    const raw = q.value.trim();
    const n = parseArNum(raw);
    const nq = normalizeArabic(raw);
    return chapters.filter((c, i) => {
      if (raw && (Number.isNaN(n) ? !searchIndex[i].includes(nq) : !String(c.id).startsWith(String(n)))) return false;
      if (filter.value === 'makkah' || filter.value === 'madinah') return c.place === filter.value;
      if (filter.value === 'offline') return !!rec && downloadState.value[surahUrl(rec, c.id)] === 'done';
      return true;
    });
  }, [q.value, filter.value, rec, downloadState.value]);

  const last = lastSession.value;
  const showResume = last && !t && findRecitation(last.recitation);

  return (
    <div class="listen">
      <PageHeader title="الاستماع للقرآن" subtitle="تلاوات لأكثر من ٢٠٠ قارئ مع تظليل الآية أثناء التلاوة" />

      <div class="listen-top">
        <button class="reciter-card card" onClick={() => (pick.value = true)} aria-haspopup="dialog">
          <span class="reciter-avatar" aria-hidden="true">
            <Icon name="mic" size={22} />
          </span>
          <span class="reciter-text">
            <span class="reciter-label">القارئ</span>
            <span class="reciter-name">{rec ? rec.name : recitationsError.value ? 'تعذر تحميل القراء' : 'جارٍ التحميل…'}</span>
            {rec && (
              <span class="reciter-style">
                {styleLabel(rec)}
                {rec.timed && (
                  <span class="tag tag-accent">
                    <Icon name="zap" size={11} /> تظليل دقيق
                  </span>
                )}
              </span>
            )}
          </span>
          <span class="btn btn-sm btn-ghost">تغيير</span>
        </button>

        {showResume && (
          <button class="resume-card card" onClick={resumeLast}>
            <span class="resume-icon">
              <Icon name="play" size={18} />
            </span>
            <span class="reciter-text">
              <span class="reciter-label">تابع الاستماع</span>
              <span class="reciter-name">سورة {chapter(last.surah).ar}</span>
              <span class="reciter-style">
                {findRecitation(last.recitation)?.name} · من <span class="ltr-num">{clock(last.time)}</span>
              </span>
            </span>
          </button>
        )}
      </div>

      <div class="listen-tools">
        <label class="search-field">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="ابحث عن سورة بالاسم أو الرقم…"
            value={q.value}
            onInput={(e) => (q.value = e.currentTarget.value)}
            aria-label="ابحث عن سورة"
          />
        </label>
        <Segmented<Filter>
          label="تصفية السور"
          value={filter.value}
          onChange={(v) => (filter.value = v)}
          scroll
          options={[
            { value: 'all', label: 'الكل' },
            { value: 'makkah', label: 'مكية' },
            { value: 'madinah', label: 'مدنية' },
            { value: 'offline', label: 'المحمّلة' },
          ]}
        />
      </div>

      {recitationsError.value && !recitations.value.length ? (
        <ErrorState text="تعذر تحميل قائمة القراء. تحقق من اتصالك بالإنترنت." onRetry={() => void loadRecitations().catch(() => {})} />
      ) : (
        <ul class="surah-grid" aria-label="السور">
          {list.map((c) => {
            const available = !rec || rec.surahs.has(c.id);
            const url = rec ? surahUrl(rec, c.id) : '';
            const dl = url ? downloadState.value[url] : undefined;
            const active = playingSurah === c.id;
            return (
              <li key={c.id} class={`surah-card card${active ? ' active' : ''}${available ? '' : ' unavailable'}`}>
                <button
                  class="surah-main"
                  disabled={!available}
                  onClick={() => (active ? toggle() : playSurah(c.id))}
                  aria-label={`${active && isPlaying.value ? 'إيقاف' : 'تشغيل'} سورة ${c.ar}`}
                >
                  <span class="surah-num">{active ? <EqualizerOrPlay /> : arNum(c.id)}</span>
                  <span class="surah-text">
                    <span class="surah-name display">سورة {c.ar}</span>
                    <span class="surah-meta">
                      {available ? (
                        <>
                          {placeLabel(c)} · {arNum(c.verses)} آية
                          {active && currentAyah.value > 0 && <> · الآية {arNum(currentAyah.value)}</>}
                        </>
                      ) : (
                        'غير متاحة بصوت هذا القارئ'
                      )}
                    </span>
                  </span>
                </button>
                {available && rec && (
                  <button
                    class={`icon-btn dl-btn${dl === 'done' ? ' on' : ''}`}
                    onClick={() => (dl === 'done' ? removeDownload(url) : downloadSurah(url, `سورة ${c.ar} - ${rec.name}`))}
                    disabled={typeof dl === 'number'}
                    aria-label={dl === 'done' ? `حذف تحميل سورة ${c.ar}` : `تحميل سورة ${c.ar} للاستماع بدون إنترنت`}
                    title={dl === 'done' ? 'محمّلة — اضغط للحذف' : 'تحميل للاستماع بدون إنترنت'}
                  >
                    {typeof dl === 'number' ? (
                      <span class="dl-pct">{arNum(Math.round(dl * 100))}٪</span>
                    ) : (
                      <Icon name={dl === 'done' ? 'checkCircle' : 'download'} size={18} />
                    )}
                  </button>
                )}
                {active && (
                  <button class="icon-btn" onClick={() => (fullPlayerOpen.value = true)} aria-label="فتح المشغل الكامل">
                    <Icon name="maximize" size={18} />
                  </button>
                )}
              </li>
            );
          })}
          {!list.length && (
            <li class="surah-empty">
              {filter.value === 'offline' ? 'لم تحمّل أي سورة بصوت هذا القارئ بعد.' : 'لا توجد سورة بهذا الاسم.'}
            </li>
          )}
        </ul>
      )}

      <ReciterPicker
        open={pick.value}
        onClose={() => (pick.value = false)}
        onPick={(r) => {
          setPref('reciter', r.id);
          pick.value = false;
          const cur = track.value;
          if (cur?.kind === 'surah' && r.surahs.has(cur.surah)) {
            void playSurah(cur.surah, { recitationId: r.id, ayah: currentAyah.value || undefined });
          }
        }}
      />
    </div>
  );
}

function EqualizerOrPlay() {
  if (status.value === 'loading') return <span class="spinner" aria-hidden="true" />;
  if (status.value === 'playing')
    return (
      <span class="eq" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  return <Icon name="play" size={16} />;
}
