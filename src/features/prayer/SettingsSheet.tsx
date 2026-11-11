import type { ComponentChildren } from 'preact';
import { arNum } from '../../lib/arabic';
import { hijriDate } from '../../lib/format';
import { prefs, setPref } from '../../state/prefs';
import { Icon } from '../../ui/Icon';
import { Segmented, Switch } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { HIGH_LAT_RULES, type MethodKey, METHODS, PRAYER_NAMES, type PrayerKey, TIME_KEYS, ZERO_ADJUSTMENTS, methodForCountry, methodInfo } from './calc';
import { DEFAULT_SETTINGS, type PrayerSettings, effectiveMethod, prayerLocation, prayerSettings, setPrayerSetting } from './prayer-state';
import { notificationPermission, setReminders } from './reminders';

/** "+٢ د" with the sign kept beside the number inside RTL text. */
function Signed({ n, unit }: { n: number; unit: string }) {
  if (!n) return <>{arNum(0)}</>;
  return (
    <>
      <bdi dir="ltr">{n > 0 ? `+${arNum(n)}` : `−${arNum(-n)}`}</bdi> {unit}
    </>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  display: ComponentChildren;
}) {
  return (
    <div class="pr-stepper" role="group" aria-label={label}>
      <button class="icon-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`إنقاص ${label}`}>
        <Icon name="minus" size={18} />
      </button>
      <output class="pr-stepper-value" aria-live="polite">
        {display}
      </output>
      <button class="icon-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`زيادة ${label}`}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

/** Calculation method, Asr, high latitudes, manual minutes, Hijri, clock and reminders. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = prayerSettings.value;
  const loc = prayerLocation.value;
  const auto = methodForCountry(loc.countryCode, loc.tz);
  const method = methodInfo(effectiveMethod.value);
  const adjusted = TIME_KEYS.some((k) => s.adjustments[k]);
  const perm = notificationPermission();

  const setAdj = (k: PrayerKey, v: number) => setPrayerSetting('adjustments', { ...ZERO_ADJUSTMENTS, ...s.adjustments, [k]: v });

  return (
    <Sheet open={open} onClose={onClose} title="إعدادات المواقيت" class="pr-set-sheet">
      <section class="pr-set-section">
        <h3 class="pr-set-title">
          <label for="pr-method">طريقة الحساب</label>
        </h3>
        <select
          id="pr-method"
          class="select"
          value={s.method}
          onChange={(e) => setPrayerSetting('method', e.currentTarget.value as MethodKey | 'auto')}
        >
          <option value="auto">تلقائي حسب البلد</option>
          {METHODS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
        <p class="hint pr-set-hint">
          {s.method === 'auto' && <strong class="pr-set-strong">{methodInfo(auto).name}: </strong>}
          {method.detail}
        </p>
      </section>

      <section class="pr-set-section">
        <h3 class="pr-set-title">وقت العصر</h3>
        <Segmented<PrayerSettings['madhab']>
          label="مذهب حساب العصر"
          value={s.madhab}
          onChange={(v) => setPrayerSetting('madhab', v)}
          options={[
            { value: 'shafi', label: 'الجمهور' },
            { value: 'hanafi', label: 'الحنفي' },
          ]}
        />
        <p class="hint pr-set-hint">
          {s.madhab === 'hanafi'
            ? 'يدخل العصر حين يصير ظلُّ الشيء مثلَيه.'
            : 'الشافعي والمالكي والحنبلي: يدخل العصر حين يصير ظلُّ الشيء مثلَه.'}
        </p>
      </section>

      <section class="pr-set-section">
        <h3 class="pr-set-title">
          <label for="pr-highlat">خطوط العرض العالية</label>
        </h3>
        <select
          id="pr-highlat"
          class="select"
          value={s.highLatRule}
          onChange={(e) => setPrayerSetting('highLatRule', e.currentTarget.value as PrayerSettings['highLatRule'])}
        >
          {HIGH_LAT_RULES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
        <p class="hint pr-set-hint">تضبط الفجر والعشاء في البلاد البعيدة عن خط الاستواء، ولا أثر لها غالبًا في البلاد العربية.</p>
      </section>

      <details class="pr-set-section pr-adj-details" open={adjusted}>
        <summary>
          <h3 class="pr-set-title">تعديل يدوي بالدقائق{adjusted && <span class="tag tag-primary pr-set-badge">مفعَّل</span>}</h3>
          <Icon name="chevronDown" size={20} />
        </summary>
        <p class="hint pr-set-hint">لمطابقة تقويم مسجدك أو بلدك إن اختلف بدقيقة أو اثنتين.</p>
        <ul class="pr-adj-list">
          {TIME_KEYS.map((k) => (
            <li key={k} class="pr-adj-row">
              <span class="pr-adj-name">{PRAYER_NAMES[k]}</span>
              <Stepper
                label={`تعديل ${PRAYER_NAMES[k]}`}
                value={s.adjustments[k] ?? 0}
                min={-30}
                max={30}
                onChange={(v) => setAdj(k, v)}
                display={<Signed n={s.adjustments[k] ?? 0} unit="د" />}
              />
            </li>
          ))}
        </ul>
        {adjusted && (
          <button class="btn btn-ghost btn-block pr-adj-reset" onClick={() => setPrayerSetting('adjustments', { ...ZERO_ADJUSTMENTS })}>
            تصفير التعديلات
          </button>
        )}
      </details>

      <section class="pr-set-section">
        <h3 class="pr-set-title">التاريخ الهجري</h3>
        <div class="pr-adj-row">
          <span class="pr-adj-name">{hijriDate(new Date(), prefs.value.hijriAdjust, loc.tz)}</span>
          <Stepper
            label="تعديل التاريخ الهجري"
            value={prefs.value.hijriAdjust}
            min={-2}
            max={2}
            onChange={(v) => setPref('hijriAdjust', v)}
            display={<Signed n={prefs.value.hijriAdjust} unit="يوم" />}
          />
        </div>
        <p class="hint pr-set-hint">التقويم المعتمد: أم القرى. عدّله بيوم أو يومين إن اختلفت رؤية الهلال في بلدك.</p>
      </section>

      <section class="pr-set-section">
        <h3 class="pr-set-title">تنسيق الوقت</h3>
        <Segmented<'12' | '24'>
          label="تنسيق الوقت"
          value={prefs.value.hour12 ? '12' : '24'}
          onChange={(v) => setPref('hour12', v === '12')}
          options={[
            { value: '12', label: '١٢ ساعة' },
            { value: '24', label: '٢٤ ساعة' },
          ]}
        />
      </section>

      <section class="pr-set-section">
        <Switch
          label="تنبيه عند دخول وقت الصلاة"
          hint={
            perm === 'denied' && s.notify
              ? 'الإشعارات محظورة في المتصفح، فسيظهر التنبيه داخل التطبيق فقط. يعمل أثناء فتح التطبيق فقط.'
              : 'يعمل أثناء فتح التطبيق فقط، ولا يصل إذا كان التطبيق مغلقًا.'
          }
          checked={s.notify}
          onChange={(v) => void setReminders(v)}
        />
      </section>

      <button
        class="btn btn-ghost btn-block pr-set-reset"
        onClick={() => (prayerSettings.value = { ...DEFAULT_SETTINGS, adjustments: { ...ZERO_ADJUSTMENTS }, notify: s.notify })}
      >
        <Icon name="refresh" size={18} /> استعادة الإعدادات الافتراضية
      </button>
    </Sheet>
  );
}
