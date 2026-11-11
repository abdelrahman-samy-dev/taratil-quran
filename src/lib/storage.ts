import { effect, signal, type Signal } from '@preact/signals';
// Runs the one-time v3 → v4 data migration before anything below can read storage.
import './migrate-v3';

/** All keys live under one namespace so backup/restore and reset are trivial. */
export const NS = 'taratil:';

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = `${NS}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null; // private mode / blocked storage: run in memory
  }
}

const store = typeof window !== 'undefined' ? safeStorage() : null;
const memory = new Map<string, string>();

export function readRaw(key: string): string | null {
  const k = NS + key;
  return store ? store.getItem(k) : (memory.get(k) ?? null);
}

export function read<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown): void {
  const k = NS + key;
  const raw = JSON.stringify(value);
  try {
    if (store) store.setItem(k, raw);
    else memory.set(k, raw);
  } catch {
    // Quota exceeded: keep the app running, the value stays in memory for this session.
    memory.set(k, raw);
  }
}

export function remove(key: string): void {
  const k = NS + key;
  store?.removeItem(k);
  memory.delete(k);
}

/** Every key in our namespace (without the prefix). */
export function keys(): string[] {
  if (!store) return [...memory.keys()].map((k) => k.slice(NS.length));
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(NS)) out.push(k.slice(NS.length));
  }
  return out;
}

/**
 * A signal backed by localStorage. Objects are merged with the fallback so new
 * fields added in later versions get their defaults.
 */
export function persisted<T>(key: string, fallback: T): Signal<T> {
  let initial = read<T>(key, fallback);
  if (isPlainObject(fallback) && isPlainObject(initial)) {
    initial = { ...fallback, ...initial };
  }
  const s = signal<T>(initial);
  let first = true;
  effect(() => {
    const v = s.value;
    if (first) {
      first = false;
      return;
    }
    write(key, v);
  });
  return s;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Local calendar day key, e.g. 2026-11-11. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}
