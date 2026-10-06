import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../api/client';

export type QueryState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: string };

export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): QueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<QueryState<T>>({ status: 'idle', data: null, error: null });
  const mountedRef = useRef(true);

  const run = useCallback(() => {
    setState({ status: 'loading', data: null, error: null });
    fetcher()
      .then((data) => {
        if (!mountedRef.current) return;
        setState({ status: 'success', data, error: null });
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        const msg =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'خطا در دریافت اطلاعات';
        setState({ status: 'error', data: null, error: msg });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => { mountedRef.current = false; };
  }, [run]);

  return { ...state, refetch: run };
}
