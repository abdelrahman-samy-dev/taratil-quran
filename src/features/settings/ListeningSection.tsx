import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { clearDownloads, downloads, removeDownload } from '../../audio/offline';
import { RATES, rate, setRate } from '../../audio/player';
import { ReciterPicker } from '../../audio/ReciterPicker';
import { findRecitation, loadRecitations, recitations, recitationsError } from '../../audio/reciters';
import { arNum } from '../../lib/arabic';
import { bytes } from '../../lib/format';
import { prefs, setPref } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { Switch } from '../../ui/kit';
import { toast } from '../../ui/toast';
import { ChoiceGroup, type Ask } from './controls';

/** 1.25 → "١٫٢٥×" */
export function rateLabel(r: number): string {
  return `${arNum(String(r)).replace('.', '٫')}×`;
}

export function ListeningSection({ ask }: { ask: Ask }) {
  const pickerOpen = useSignal(false);

  useEffect(() => {
    void loadRecitations().catch(() => {});
  }, []);

  const current = recitations.value.length ? findRecitation(prefs.value.reciter) : undefined;
  const list = [...downloads.value].sort((a, b) => b.at - a.at);
  const total = list.reduce((s, d) => s + d.size, 0);

  const removeAll = async () => {
    const ok = await ask({
      title: 'حذف كل التلاوات المحمّلة؟',
      body: <p>ستحتاج إلى الإنترنت للاستماع إليها مرة أخرى. يُحرَّر {bytes(total)} من المساحة.</p>,
      confirm: 'حذف الكل',
      danger: true,
    });
    if (!ok) return;
    await clearDownloads();
    toast('حُذفت كل التلاوات المحمّلة');
  };

  return (
    <>
      <Switch
        label="تشغيل السورة التالية تلقائياً"
        hint="عند انتهاء السورة الحالية"
        checked={prefs.value.autoplay}
        onChange={(v) => setPref('autoplay', v)}
      />

      <div class="setting-row set-static">
        <span class="setting-text">
          <span class="setting-label">القارئ الافتراضي</span>
          <span class="setting-hint">
            {current
              ? `${current.name} · ${current.style}`
              : recitationsError.value
                ? 'تعذر تحميل قائمة القراء الآن'
                : 'جارٍ تحميل اسم القارئ…'}
          </span>
        </span>
        <button class="btn btn-sm btn-ghost" onClick={() => (pickerOpen.value = true)} aria-haspopup="dialog">
          <Icon name="mic" size={16} /> تغيير
        </button>
      </div>

      <div class="set-block-inline">
        <ChoiceGroup
          name="set-rate"
          legend="سرعة التلاوة الافتراضية"
          value={rate.value}
          options={RATES.map((r) => ({ value: r, label: rateLabel(r) }))}
          onChange={(r) => setRate(r)}
          class="set-rates"
        />
      </div>

      <div class="set-block">
        <div class="set-sub-row">
          <h3 class="set-sub">التلاوات المحمّلة</h3>
          {list.length > 0 && (
            <span class="tag">
              {arNum(list.length)} · {bytes(total)}
            </span>
          )}
        </div>
        {!list.length ? (
          <p class="setting-hint set-empty-line">
            <Icon name="download" size={16} /> لا توجد تلاوات محمّلة. حمّل السور من{' '}
            <a href="/listen" class="set-link">
              صفحة الاستماع
            </a>{' '}
            لتسمعها دون إنترنت.
          </p>
        ) : (
          <>
            <ul class="set-downloads">
              {list.map((d) => (
                <li key={d.url} class="set-download">
                  <span class="set-download-icon" aria-hidden="true">
                    <Icon name="headphones" size={18} />
                  </span>
                  <span class="set-download-text">
                    <span class="set-download-title">{d.title}</span>
                    <span class="set-download-size">{bytes(d.size)}</span>
                  </span>
                  <button
                    class="icon-btn set-del"
                    aria-label={`حذف ${d.title}`}
                    onClick={async () => {
                      await removeDownload(d.url);
                      toast(`حُذفت ${d.title}`);
                    }}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <button class="btn btn-sm btn-danger set-del-all" onClick={removeAll}>
              <Icon name="trash" size={16} /> حذف كل التلاوات المحمّلة
            </button>
          </>
        )}
      </div>

      <ReciterPicker
        open={pickerOpen.value}
        onClose={() => (pickerOpen.value = false)}
        onPick={(r) => {
          setPref('reciter', r.id);
          pickerOpen.value = false;
          toast(`القارئ الافتراضي: ${r.name}`);
        }}
      />
    </>
  );
}
