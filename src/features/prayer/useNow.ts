import { useEffect, useState } from 'preact/hooks';

/**
 * Current time, re-rendering on each `step` boundary (aligned to the wall
 * clock) and when the tab becomes visible again (timers sleep in background).
 */
export function useNow(step = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const wait = step - (Date.now() % step) + 15;
      timer = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, wait);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [step]);
  return now;
}
