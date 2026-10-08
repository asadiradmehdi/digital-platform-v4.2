import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorText } from '../api/app';

export type Remote<T> = { status: 'loading' | 'success' | 'error'; data: T | null; error: string | null };

/**
 * Fetches when the screen gains focus and keeps the last good data while refreshing,
 * so returning to a tab never flashes a spinner over content that is already on screen.
 */
export function useRemote<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<Remote<T>>({ status: 'loading', data: null, error: null });
  const ref = useRef(fetcher);
  // Keep the latest fetcher without touching the ref during render; this runs before the focus effect below.
  useEffect(() => { ref.current = fetcher; });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(() => {
    ref.current()
      .then(data => { if (alive.current) setState({ status: 'success', data, error: null }); })
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
