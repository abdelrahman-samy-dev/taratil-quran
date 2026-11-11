/**
 * Device compass heading (degrees clockwise from north).
 * - Android / Chromium: `deviceorientationabsolute` → 360 − alpha.
 * - iOS Safari: `deviceorientation` → webkitCompassHeading, after
 *   DeviceOrientationEvent.requestPermission() from a user tap.
 * Updates go into signals so the dial can move at sensor rate without
 * re-rendering the page.
 */
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { angleDiff } from './calc';

export type CompassStatus = 'idle' | 'prompt' | 'starting' | 'live' | 'denied' | 'unavailable';

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type PermissionCtor = { requestPermission?: () => Promise<'granted' | 'denied' | 'default'> };

const NO_EVENT_MS = 3000;

function screenAngle(): number {
  const a = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
  return Number.isFinite(a) ? a : 0;
}

export function needsPermission(): boolean {
  return typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as unknown as PermissionCtor).requestPermission === 'function';
}

export function useCompass() {
  const status = useSignal<CompassStatus>('idle');
  /** Smoothed heading 0–360, null until the first reading. */
  const heading = useSignal<number | null>(null);
  /** Unwrapped heading (never jumps 359 → 0), for rotating the dial. */
  const turn = useSignal(0);
  /** iOS only: estimated error in degrees (−1 = uncalibrated). */
  const accuracy = useSignal<number | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const attach = () => {
    detach.current?.();
    status.value = 'starting';
    let got = false;
    let smooth: number | null = null;

    const push = (raw: number) => {
      if (!Number.isFinite(raw)) return;
      const h = (((raw + screenAngle()) % 360) + 360) % 360;
      if (smooth == null) {
        smooth = h;
        turn.value = h;
      } else {
        // Low-pass on the circle: follow 25 % of the shortest way each reading.
        const step = angleDiff(h, smooth) * 0.25;
        smooth = (((smooth + step) % 360) + 360) % 360;
        turn.value += step;
      }
      heading.value = smooth;
      if (!got) {
        got = true;
        status.value = 'live';
      }
    };

    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (e.alpha != null) push(360 - e.alpha);
    };
    const onRelative = (e: DeviceOrientationEvent) => {
      const ios = e as IOSOrientationEvent;
      if (typeof ios.webkitCompassHeading === 'number') {
        accuracy.value = typeof ios.webkitCompassAccuracy === 'number' ? ios.webkitCompassAccuracy : null;
        push(ios.webkitCompassHeading);
      } else if (e.absolute && e.alpha != null) {
        push(360 - e.alpha);
      }
    };

    const absoluteSupported = 'ondeviceorientationabsolute' in window;
    if (absoluteSupported) window.addEventListener('deviceorientationabsolute' as 'deviceorientation', onAbsolute);
    window.addEventListener('deviceorientation', onRelative);
    const timer = window.setTimeout(() => {
      if (!got) status.value = 'unavailable';
    }, NO_EVENT_MS);

    detach.current = () => {
      clearTimeout(timer);
      if (absoluteSupported) window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', onAbsolute);
      window.removeEventListener('deviceorientation', onRelative);
      detach.current = null;
    };
  };

  /** Call from a tap (iOS needs a user gesture for the permission prompt). */
  const start = async () => {
    const ctor = DeviceOrientationEvent as unknown as PermissionCtor;
    if (ctor.requestPermission) {
      try {
        const res = await ctor.requestPermission();
        if (res !== 'granted') {
          status.value = 'denied';
          return;
        }
      } catch {
        status.value = 'denied';
        return;
      }
    }
    attach();
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      status.value = 'unavailable';
      return;
    }
    // Chromium has the absolute event and needs no prompt (even where it now
    // exposes requestPermission); iOS Safari must ask from a tap.
    if ('ondeviceorientationabsolute' in window || !needsPermission()) attach();
    else status.value = 'prompt';
    return () => detach.current?.();
  }, []);

  return { status, heading, turn, accuracy, start };
}
