import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorText } from '../api/app';

export type Remote<T> = { status: 'loading' | 'success' | 'error'; data: T | null; error: string | null };

// Last good answer per query, so opening a screen again paints at once and refreshes quietly behind it.
const cache = new Map<string, unknown>();
/** Called on sign-out so the next account never sees the previous one's data. */
export function clearRemoteCache() { cache.clear(); }

/** Warms the cache for a screen's first paint (same name + deps as the screen's own useRemote call); failures are ignored. */
export function prefetchRemote<T>(name: string, fetcher: () => Promise<T>, deps: unknown[] = []) {
  fetcher().then(data => { cache.set(`${name}|${JSON.stringify(deps)}`, data); }).catch(() => undefined);
}

/**
 * Fetches when the screen gains focus and keeps the last good data while refreshing,
 * so returning to a tab never flashes a spinner over content that is already on screen.
 */
export function useRemote<T>(name: string, fetcher: () => Promise<T>, deps: unknown[] = []) {
  // The key must be an explicit name: in a release (Hermes bytecode) build every function stringifies the same, so
  // keying on the function text made unrelated screens share one cache entry and render each other's data.
  const cacheKey = `${name}|${JSON.stringify(deps)}`;
  const [state, setState] = useState<Remote<T>>(() => (cache.has(cacheKey)
    ? { status: 'success', data: cache.get(cacheKey) as T, error: null }
    : { status: 'loading', data: null, error: null }));
  const keyRef = useRef(cacheKey);
  useEffect(() => { keyRef.current = cacheKey; });
  const ref = useRef(fetcher);
  // Keep the latest fetcher without touching the ref during render; this runs before the focus effect below.
  useEffect(() => { ref.current = fetcher; });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(() => {
    ref.current()
      .then(data => { cache.set(keyRef.current, data); if (alive.current) setState({ status: 'success', data, error: null }); })
      .catch((e: unknown) => {
        if (!alive.current) return;
        setState(s => (s.data != null ? s : { status: 'error', data: null, error: errorText(e, 'دریافت اطلاعات انجام نشد.') }));
      });
  }, []);

  const retry = useCallback(() => { setState({ status: 'loading', data: null, error: null }); load(); }, [load]);

  // Refetch on focus, and again whenever the caller's inputs (e.g. page) change while focused.
  const key = JSON.stringify(deps);
  useFocusEffect(useCallback(() => { if (key) load(); }, [load, key]));

  return { ...state, reload: load, retry };
}
