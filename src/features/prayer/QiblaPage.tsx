import { computed, useComputed, useSignal, useSignalEffect } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { arNum } from '../../lib/arabic';
import { haptic } from '../../lib/device';
import { Icon } from '../../ui/Icon';
import { PageHeader } from '../../ui/kit';
import { angleDiff, compassName, kaabaDistanceKm, qiblaBearing } from './calc';
import { type CompassStatus, useCompass } from './compass';
import { placeLabel } from './geo';
import { LocationSheet } from './LocationSheet';
import { isDefaultLocation, migrateLegacyCity, prayerLocation } from './prayer-state';
import './qibla.css';

const C = 160; // dial centre in SVG units
const ALIGN_IN = 5;
const ALIGN_OUT = 8;
const CARDINALS = [
  { deg: 0, label: 'ش' },
  { deg: 90, label: 'ق' },
  { deg: 180, label: 'ج' },
  { deg: 270, label: 'غ' },
];
const kmFmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

function polar(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

function deg(n: number): string {
  return `${arNum(Math.round(((n % 360) + 360) % 360))}°`;
}

/** Static parts of the dial (ticks, letters); memoised, it never changes. */
function DialFace() {
  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const [x1, y1] = polar(d, major ? 134 : 140);
    const [x2, y2] = polar(d, 147);
    ticks.push(<line key={d} x1={x1} y1={y1} x2={x2} y2={y2} class={major ? 'qb-tick major' : 'qb-tick'} />);
  }
  const numbers = [30, 60, 120, 150, 210, 240, 300, 330].map((d) => {
    const [x, y] = polar(d, 120);
    return (
      <text key={d} x={x} y={y} class="qb-num" text-anchor="middle" dominant-baseline="central">
        {arNum(d)}
      </text>
    );
  });
  const letters = CARDINALS.map((c) => {
    const [x, y] = polar(c.deg, 117);
    return (
      <text key={c.deg} x={x} y={y} class={`qb-cardinal${c.deg === 0 ? ' north' : ''}`} text-anchor="middle" dominant-baseline="central">
        {c.label}
      </text>
    );
  });
  return (
    <>
      <circle cx={C} cy={C} r={152} class="qb-bezel" />
      <circle cx={C} cy={C} r={100} class="qb-inner" />
      {ticks}
      {numbers}
      {letters}
    </>
  );
}

function Kaaba({ x, y }: { x: number; y: number }) {
  return (
    <g class="qb-kaaba" transform={`translate(${x - 12} ${y - 13})`}>
      <rect width="24" height="26" rx="2.5" class="qb-kaaba-body" />
      <rect y="6" width="24" height="3.5" class="qb-kaaba-band" />
      <rect x="14.5" y="14" width="5" height="12" rx="1" class="qb-kaaba-door" />
    </g>
  );
}

function statusText(status: CompassStatus): string {
  switch (status) {
    case 'starting':
      return isTouch ? 'جارٍ تشغيل البوصلة…' : '';
    case 'denied':
      return 'لم يُسمح باستخدام مستشعر الاتجاه. يمكنك الاعتماد على الدرجة الموضّحة مع أي بوصلة.';
    case 'unavailable':
      return isTouch ? 'تعذّرت قراءة البوصلة في هذا الجهاز. استخدم الدرجة الموضّحة مع بوصلة عادية.' : '';
    default:
      return '';
  }
}

export default function QiblaPage() {
  const [locOpen, setLocOpen] = useState(false);
  const loc = prayerLocation.value;
  const bearing = useMemo(() => qiblaBearing(loc.lat, loc.lon), [loc]);
  const km = useMemo(() => kaabaDistanceKm(loc.lat, loc.lon), [loc]);
  const { status, heading, turn, accuracy, start } = useCompass();
  const live = status.value === 'live';

  // Bearing as a signal so the computed values below follow location changes.
  const bearingSig = useComputed(() => qiblaBearing(prayerLocation.value.lat, prayerLocation.value.lon));
  const diff = useComputed(() => (heading.value == null ? null : angleDiff(bearingSig.value, heading.value)));
  const alignedSig = useSignal(false);

  useSignalEffect(() => {
    const d = diff.value;
    const was = alignedSig.peek();
    // Hysteresis so the state (and the buzz) does not flicker at the edge.
    const now = d != null && Math.abs(d) <= (was ? ALIGN_OUT : ALIGN_IN);
    if (now !== was) {
      alignedSig.value = now;
      if (now) haptic([25, 40, 25]);
    }
  });

  useEffect(() => {
    void migrateLegacyCity();
  }, []);

  // Dial rotation bound straight to the DOM (no re-render per sensor event).
  const dialTransform = useMemo(() => computed(() => `rotate(${-turn.value} ${C} ${C})`), []);
  const dialClass = useComputed(() => `qb-dial${alignedSig.value ? ' aligned' : ''}${status.value === 'live' ? ' live' : ''}`);
  const headingText = useComputed(() => (heading.value == null ? '' : deg(heading.value)));
  const guide = useComputed(() => {
    const d = diff.value;
    if (d == null) return '';
    if (alignedSig.value) return 'أنت متجه إلى القبلة';
    return d > 0 ? `استدر يمينًا ${deg(Math.abs(d))}` : `استدر يسارًا ${deg(Math.abs(d))}`;
  });
  const lowAccuracy = useComputed(() => accuracy.value != null && (accuracy.value < 0 || accuracy.value > 25));

  const [kx, ky] = polar(bearing, 76);
  const [sx, sy] = polar(bearing, 44);
  const [nx, ny] = polar(bearing, 60);
  const message = statusText(status.value);

  return (
    <div class="qb-page">
      <PageHeader
        title="اتجاه القبلة"
        subtitle={
          <button class="qb-place" onClick={() => setLocOpen(true)} aria-haspopup="dialog" aria-label={`الموقع: ${placeLabel(loc)}. تغيير الموقع`}>
            <Icon name="mapPin" size={16} />
            <span>{placeLabel(loc)}</span>
            <span class="qb-place-change">تغيير</span>
          </button>
        }
      />

      {isDefaultLocation.value && (
        <div class="qb-default card" role="note">
          <Icon name="info" size={20} />
          <p>الاتجاه الظاهر محسوب للقاهرة. حدِّد موقعك ليكون اتجاه القبلة دقيقًا.</p>
          <button class="btn" onClick={() => setLocOpen(true)} aria-haspopup="dialog">
            حدِّد موقعي
          </button>
        </div>
      )}

      <div class="qb-layout">
        <section class="qb-stage card" aria-label="البوصلة">
          <p class={`qb-guide${live ? '' : ' static'}`} aria-live="polite">
            {live ? <span class={alignedSig.value ? 'ok' : ''}>{guide}</span> : `القبلة على ${deg(bearing)} من الشمال`}
          </p>

          <div class={dialClass}>
            <svg viewBox="0 0 320 320" role="img" aria-label={`بوصلة القبلة: ${deg(bearing)} من الشمال باتجاه ${compassName(bearing)}`}>
              <g transform={dialTransform}>
                <DialFace />
                <line x1={sx} y1={sy} x2={nx} y2={ny} class="qb-needle" />
                <Kaaba x={kx} y={ky} />
              </g>
              {live && <path d={`M${C} 4 l-9 14 h18 z`} class="qb-pointer" />}
            </svg>
            <div class="qb-center" aria-hidden="true">
              <span class="qb-center-deg">{live ? headingText : deg(bearing)}</span>
              <span class="qb-center-cap">{live ? 'اتجاه هاتفك' : 'من الشمال'}</span>
            </div>
          </div>

          {status.value === 'prompt' && (
            <button class="btn qb-start" onClick={() => void start()}>
              <Icon name="compass" size={20} /> تفعيل البوصلة
            </button>
          )}
          {message && (
            <p class={`qb-status${status.value === 'denied' || status.value === 'unavailable' ? ' warn' : ''}`} role="status">
              {message}
            </p>
          )}
          {live && lowAccuracy.value && (
            <p class="qb-status warn" role="status">
              دقة البوصلة منخفضة: حرّك الهاتف في الهواء على شكل الرقم ٨ لمعايرتها.
            </p>
          )}
        </section>

        <div class="qb-side">
          <dl class="qb-facts">
            <div class="card">
              <dt>اتجاه القبلة</dt>
              <dd>
                <strong>{deg(bearing)}</strong>
                <span>نحو {compassName(bearing)}</span>
              </dd>
            </div>
            <div class="card">
              <dt>المسافة إلى الكعبة</dt>
              <dd>
                <strong>{kmFmt.format(Math.round(km))} كم</strong>
                <span>أقصر مسافة على سطح الأرض</span>
              </dd>
            </div>
          </dl>

          <div class="qb-howto card">
            <h2 class="qb-howto-title">
              <Icon name="info" size={18} /> {live ? 'للحصول على اتجاه أدق' : 'كيف أجد القبلة؟'}
            </h2>
            {live ? (
              <ul>
                <li>أمسك الهاتف أفقيًا ووجّه أعلاه أمامك.</li>
                <li>استدر حتى يصل رمز الكعبة إلى السهم في الأعلى ويتلوّن القرص.</li>
                <li>ابتعد عن المعادن والأجهزة الكهربائية؛ فهي تُربك البوصلة بضع درجات.</li>
              </ul>
            ) : (
              <ol>
                <li>استخدم بوصلة أو تطبيق بوصلة، وضعها على سطح مستوٍ بعيدًا عن المعادن.</li>
                <li>حدِّد اتجاه الشمال، ثم استدر مع عقارب الساعة بمقدار {deg(bearing)}.</li>
                <li>ستكون متجهًا نحو {compassName(bearing)} تقريبًا، وهو اتجاه القبلة من {loc.name}.</li>
              </ol>
            )}
            {!live && status.value !== 'prompt' && isTouch && status.value !== 'denied' && (
              <p class="hint">على الهاتف تعمل البوصلة الحية إذا كان الجهاز يحتوي على مستشعر اتجاه.</p>
            )}
          </div>
        </div>
      </div>

      <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
    </div>
  );
}
