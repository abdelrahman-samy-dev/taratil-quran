import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { clearDownloads } from '../../audio/offline';
import { stop } from '../../audio/player';
import { arNum } from '../../lib/arabic';
import { bytes } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { Progress } from '../../ui/kit';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { applyBackup, clearContentCaches, downloadBackup, parseBackup, wipeAll } from './backup';
import type { Ask } from './controls';

interface Usage {
  usage: number;
  quota: number;
  persisted: boolean | null;
}

/** Stop the player and let its pause handlers write, so nothing overwrites the new data before reload. */
async function replaceAndReload(fn: () => void | Promise<void>) {
  stop();
  await new Promise((r) => setTimeout(r, 120));
  await fn();
  location.reload();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function DataSection({ ask }: { ask: Ask }) {
  const file = useRef<HTMLInputElement>(null);
  const usage = useSignal<Usage | null>(null);
  const resetStep = useSignal<0 | 1 | 2>(0);
  const busy = useSignal(false);
  const safeBtn = useRef<HTMLButtonElement>(null);

  // The step-2 buttons replace the focused one: move focus to the safe choice.
  useEffect(() => {
    if (resetStep.value === 2) requestAnimationFrame(() => safeBtn.current?.focus());
  }, [resetStep.value]);

  const measure = async () => {
    const s = navigator.storage;
    if (!s?.estimate) return;
    try {
      const [est, persisted] = await Promise.all([s.estimate(), s.persisted ? s.persisted() : Promise.resolve(null)]);
      usage.value = { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
    } catch {
      /* not available */
    }
  };

  useEffect(() => {
    void measure();
  }, []);

  const exportNow = () => {
    const n = downloadBackup();
    toast(`حُفظت النسخة الاحتياطية (${arNum(n)} عنصراً)`);
  };

  const importFile = async (f: File) => {
    const parsed = parseBackup(await f.text());
    if (!parsed.ok) {
      toast(parsed.error, undefined, 5000);
      return;
    }
    const { backup } = parsed;
    const date = formatDate(backup.exportedAt);
    const ok = await ask({
      title: 'استعادة النسخة الاحتياطية؟',
      body: (
        <>
          <p>
            {date ? `نسخة بتاريخ ${date}، ` : ''}تحتوي على {arNum(Object.keys(backup.data).length)} عنصراً.
          </p>
          <p>ستحل محل تقدمك وعلاماتك وإعداداتك الحالية على هذا الجهاز، ثم يُعاد تشغيل التطبيق.</p>
        </>
      ),
      confirm: 'استعادة',
    });
    if (!ok) return;
    await replaceAndReload(() => void applyBackup(backup));
  };

  const persist = async () => {
    try {
      const ok = await navigator.storage?.persist?.();
      toast(
        ok ? 'بياناتك الآن محمية من الحذف التلقائي' : 'لم يوافق المتصفح على الطلب الآن، ويمنحه عادةً للتطبيقات المثبتة',
      );
    } catch {
      toast('المتصفح لا يدعم هذا الطلب');
    }
    void measure();
  };

  const clearCache = async () => {
    const ok = await ask({
      title: 'مسح المحتوى المؤقت؟',
      body: (
        <p>
          تُحذف صفحات المصحف والتفاسير والبيانات المخزنة مؤقتاً، وتُنزَّل من جديد عند الحاجة. لا يمس ذلك تقدمك ولا
          التلاوات المحمّلة.
        </p>
      ),
      confirm: 'مسح',
    });
    if (!ok) return;
    busy.value = true;
    try {
      const n = await clearContentCaches();
      toast(n ? 'مُسح المحتوى المؤقت' : 'لا يوجد محتوى مؤقت لمسحه');
    } catch {
      toast('تعذر مسح المحتوى المؤقت');
    } finally {
      busy.value = false;
      void measure();
    }
  };

  const u = usage.value;

  return (
    <>
      <div class="set-block">
        <h3 class="set-sub">النسخ الاحتياطي</h3>
        <p class="setting-hint">احفظ تقدمك وعلاماتك وإعداداتك في ملف، واستعدها على هذا الجهاز أو غيره.</p>
        <div class="set-actions">
          <button class="btn" onClick={exportNow}>
            <Icon name="download" size={18} /> تصدير نسخة احتياطية
          </button>
          <button class="btn btn-outline" onClick={() => file.current?.click()}>
            <Icon name="upload" size={18} /> استيراد نسخة
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            class="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (f) void importFile(f);
            }}
          />
        </div>
      </div>

      <div class="set-block">
        <h3 class="set-sub">التخزين</h3>
        {u ? (
          <>
            <div class="set-usage">
              <span>
                يستخدم تراتيل <b>{bytes(u.usage)}</b>
                {u.quota > 0 && <> من أصل {bytes(u.quota)} متاحة</>}
              </span>
            </div>
            {u.quota > 0 && <Progress value={u.usage} max={u.quota} label="المساحة المستخدمة" />}
            <div class="set-persist">
              <span class={`set-persist-state${u.persisted ? ' on' : ''}`}>
                <Icon name={u.persisted ? 'checkCircle' : 'info'} size={16} />
                {u.persisted
                  ? 'البيانات محمية من الحذف التلقائي'
                  : 'قد يحذف المتصفح البيانات المخزنة عند امتلاء المساحة'}
              </span>
              {u.persisted === false && (
                <button class="btn btn-sm btn-ghost" onClick={persist}>
                  طلب الحماية
                </button>
              )}
            </div>
          </>
        ) : (
          <p class="setting-hint">لا يتيح هذا المتصفح معرفة المساحة المستخدمة.</p>
        )}
        <div class="set-row-action">
          <span class="setting-text">
            <span class="setting-label">مسح المحتوى المؤقت</span>
            <span class="setting-hint">صفحات وتفاسير مخزنة لتسريع التطبيق، تُنزَّل من جديد عند الحاجة</span>
          </span>
          <button class="btn btn-sm btn-ghost" onClick={clearCache} disabled={busy.value}>
            <Icon name="refresh" size={16} /> مسح
          </button>
        </div>
      </div>

      <div class="set-block set-danger-zone">
        <div class="set-row-action">
          <span class="setting-text">
            <span class="setting-label">مسح كل البيانات</span>
            <span class="setting-hint">يعيد التطبيق كما كان عند أول تشغيل</span>
          </span>
          <button class="btn btn-sm btn-danger" onClick={() => (resetStep.value = 1)}>
            <Icon name="trash" size={16} /> مسح الكل
          </button>
        </div>
      </div>

      <Sheet
        open={resetStep.value > 0}
        onClose={() => (resetStep.value = 0)}
        title={resetStep.value === 2 ? 'تأكيد أخير' : 'مسح كل البيانات؟'}
      >
        <div class="confirm">
          <div class="confirm-body">
            {resetStep.value === 1 ? (
              <p>
                سيُحذف سجل قراءتك وخطة الختمة والعلامات والإنجازات والإعدادات والتلاوات المحمّلة. ننصح بتصدير نسخة
                احتياطية أولاً.
              </p>
            ) : (
              <p>
                <b>لا يمكن التراجع عن هذا.</b> هل تريد فعلاً مسح كل بيانات تراتيل على هذا الجهاز؟
              </p>
            )}
          </div>
          <div class="confirm-actions">
            {resetStep.value === 1 ? (
              <>
                <button class="btn btn-danger" onClick={() => (resetStep.value = 2)}>
                  متابعة
                </button>
                <button class="btn btn-ghost" onClick={exportNow}>
                  <Icon name="download" size={18} /> تصدير نسخة أولاً
                </button>
              </>
            ) : (
              <>
                <button
                  class="btn btn-danger-solid"
                  onClick={() =>
                    void replaceAndReload(async () => {
                      await clearDownloads();
                      wipeAll();
                    })
                  }
                >
                  امسح كل شيء
                </button>
                <button ref={safeBtn} class="btn btn-ghost" onClick={() => (resetStep.value = 0)}>
                  تراجع
                </button>
              </>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
