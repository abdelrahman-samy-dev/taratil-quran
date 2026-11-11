import { beforeEach, describe, expect, it } from 'vitest';
import { stats, today } from '../../src/state/progress';
import {
  type Config,
  DEFAULT_CONFIG,
  GUIDED_TOTAL,
  classifyTap,
  config,
  configure,
  count,
  dhikrText,
  flush,
  guidedPosition,
  lifetimeCount,
  resetSession,
  restore,
  ringFraction,
  tap,
  todayCount,
  undo,
} from '../../src/features/tasbeeh/tasbeeh-state';

const free = (target: Config['target']): Config => ({ ...DEFAULT_CONFIG, target });
const guidedCfg: Config = { ...DEFAULT_CONFIG, mode: 'guided' };

describe('guided tasbeeh (Muslim 597)', () => {
  it('is 33 + 33 + 33 + 1', () => {
    expect(GUIDED_TOTAL).toBe(100);
    expect(guidedPosition(0)).toEqual({ step: 0, inStep: 0, stepCount: 33, done: false });
    expect(guidedPosition(32)).toMatchObject({ step: 0, inStep: 32 });
    expect(guidedPosition(33)).toMatchObject({ step: 1, inStep: 0 });
    expect(guidedPosition(98)).toMatchObject({ step: 2, inStep: 32 });
    expect(guidedPosition(99)).toMatchObject({ step: 3, inStep: 0, stepCount: 1 });
    expect(guidedPosition(100)).toMatchObject({ step: 3, done: true });
  });

  it('classifies step ends, completion and extra taps', () => {
    expect(classifyTap(guidedCfg, 1)).toBe('tap');
    expect(classifyTap(guidedCfg, 33)).toBe('step');
    expect(classifyTap(guidedCfg, 66)).toBe('step');
    expect(classifyTap(guidedCfg, 99)).toBe('step');
    expect(classifyTap(guidedCfg, 100)).toBe('complete');
    expect(classifyTap(guidedCfg, 101)).toBe('ignored');
  });

  it('shows the right dhikr for each step', () => {
    expect(dhikrText(guidedCfg, 0)).toBe('سُبْحَانَ اللَّهِ');
    expect(dhikrText(guidedCfg, 33)).toBe('الْحَمْدُ لِلَّهِ');
    expect(dhikrText(guidedCfg, 66)).toBe('اللَّهُ أَكْبَرُ');
    expect(dhikrText(guidedCfg, 99)).toMatch(/^لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ/);
  });
});

describe('free tasbeeh', () => {
  it('hits the target on every full round, never in open mode', () => {
    expect(classifyTap(free(33), 33)).toBe('target');
    expect(classifyTap(free(33), 34)).toBe('tap');
    expect(classifyTap(free(33), 66)).toBe('target');
    expect(classifyTap(free(0), 1000)).toBe('tap');
  });

  it('fills the ring per round', () => {
    expect(ringFraction(free(33), 0)).toBe(0);
    expect(ringFraction(free(100), 50)).toBe(0.5);
    expect(ringFraction(free(33), 33)).toBe(1);
    expect(ringFraction(free(33), 34)).toBeCloseTo(1 / 33);
    expect(ringFraction(free(0), 500)).toBe(0);
  });

  it('falls back to a preset when the custom text is empty', () => {
    expect(dhikrText({ ...DEFAULT_CONFIG, preset: 'custom', custom: '  سبحان الله العظيم ' }, 0)).toBe('سبحان الله العظيم');
    expect(dhikrText({ ...DEFAULT_CONFIG, preset: 'custom', custom: '' }, 0)).toBe('سُبْحَانَ اللَّهِ');
    expect(dhikrText({ ...DEFAULT_CONFIG, preset: 'unknown' }, 0)).toBe('سُبْحَانَ اللَّهِ');
  });
});

describe('session, today and lifetime counts', () => {
  beforeEach(() => {
    today.value = '2026-11-11';
    config.value = DEFAULT_CONFIG;
    count.value = 0;
    flush();
    stats.value = { azkarTotal: 0, tasbeehTotal: 0, surahsListened: 0, khatmas: 0, badges: [] };
  });

  it('batches the lifetime stat until flush, including undo', () => {
    const before = todayCount.value;
    for (let i = 0; i < 5; i++) tap();
    expect(count.value).toBe(5);
    expect(stats.value.tasbeehTotal).toBe(0);
    expect(lifetimeCount.value).toBe(5);
    expect(todayCount.value).toBe(before + 5);

    undo();
    expect(lifetimeCount.value).toBe(4);
    flush();
    expect(stats.value.tasbeehTotal).toBe(4);

    undo();
    flush();
    expect(stats.value.tasbeehTotal).toBe(3);
    expect(JSON.parse(localStorage.getItem('taratil:tasbeeh:session')!).count).toBe(3);
  });

  it('stops counting when the guided round is complete', () => {
    configure({ mode: 'guided' });
    for (let i = 0; i < GUIDED_TOTAL + 5; i++) tap();
    expect(count.value).toBe(GUIDED_TOTAL);
    flush();
    expect(stats.value.tasbeehTotal).toBe(GUIDED_TOTAL);
  });

  it('starts a new session on a change and can restore the previous one', () => {
    tap();
    tap();
    const prev = configure({ preset: 'hamd' });
    expect(prev).toMatchObject({ count: 2, config: { preset: 'subhan' } });
    expect(count.value).toBe(0);
    expect(configure({ preset: 'hamd' })).toBeNull();
    restore(prev!);
    expect(config.value.preset).toBe('subhan');
    expect(count.value).toBe(2);

    const snap = resetSession();
    expect(snap.count).toBe(2);
    expect(count.value).toBe(0);
  });

  it('resets the today count on a new day', () => {
    tap();
    expect(todayCount.value).toBeGreaterThan(0);
    today.value = '2026-11-12';
    expect(todayCount.value).toBe(0);
    tap();
    expect(todayCount.value).toBe(1);
  });

  it('never lets undo go below zero', () => {
    expect(undo()).toBe(false);
    expect(count.value).toBe(0);
  });
});
