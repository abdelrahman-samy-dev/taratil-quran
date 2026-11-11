import { describe, expect, it, beforeEach } from 'vitest';
import { addDays } from '../../src/lib/storage';
import { log, markPageRead, streak, today, todayLog, werd, werdTarget, planProgress } from '../../src/state/progress';

const day = (pages: number[]) => ({ pages, azkar: [], listen: 0 });

describe('reading progress', () => {
  beforeEach(() => {
    today.value = '2026-11-11';
    log.value = {};
    werd.value = { goal: 10, plan: null };
  });

  it('logs each page once per day', () => {
    markPageRead(5);
    markPageRead(5);
    markPageRead(6);
    expect(todayLog.value.pages).toEqual([5, 6]);
  });

  it('counts a streak only for days with real activity', () => {
    log.value = {
      [addDays('2026-11-11', -3)]: day([1]),
      [addDays('2026-11-11', -2)]: day([2]),
      [addDays('2026-11-11', -1)]: day([3]),
    };
    // Today not started yet: the streak from yesterday still counts.
    expect(streak.value).toBe(3);
    markPageRead(4);
    expect(streak.value).toBe(4);
    log.value = { '2026-11-09': day([1]), '2026-11-11': day([2]) };
    expect(streak.value).toBe(1);
  });

  it('derives the daily target from a khatma plan', () => {
    expect(werdTarget.value).toBe(10);
    werd.value = { goal: 10, plan: { start: '2026-11-11', days: 30, fromPage: 1 } };
    expect(werdTarget.value).toBe(21); // ceil(604 / 30)
    markPageRead(1);
    markPageRead(2);
    expect(planProgress.value).toMatchObject({ read: 2, total: 604, day: 1, days: 30 });
  });
});
