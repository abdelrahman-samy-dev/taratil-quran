const inflight = new Map<string, Promise<unknown>>();
const memo = new Map<string, unknown>();

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

interface FetchOptions {
  timeout?: number;
  retries?: number;
  /** Keep the parsed result in memory for the session (default true). */
  memo?: boolean;
  signal?: AbortSignal;
}

/**
 * fetch + JSON with timeout, retry on network/5xx errors, request de-duplication
 * and an in-memory cache. Offline persistence is the service worker's job.
 */
export async function fetchJSON<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeout = 15_000, retries = 2, memo: useMemo = true, signal } = opts;
  if (useMemo && memo.has(url)) return memo.get(url) as T;
  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const run = (async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const onAbort = () => ctrl.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) {
          lastErr = new HttpError(res.status, url);
          if (res.status < 500 && res.status !== 429) break;
        } else {
          const data = (await res.json()) as T;
          if (useMemo) memo.set(url, data);
          return data;
        }
      } catch (err) {
        lastErr = err;
        if (signal?.aborted) break;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
    throw lastErr;
  })();

  inflight.set(url, run);
  try {
    return await run;
  } finally {
    inflight.delete(url);
  }
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);
