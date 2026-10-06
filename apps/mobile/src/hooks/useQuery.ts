/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from 'react';
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
  const cancelRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = () => {
    cancelRef.current = false;
    setState({ status: 'loading', data: null, error: null });
    fetcherRef.current()
      .then((data) => {
        if (!cancelRef.current) setState({ status: 'success', data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelRef.current) {
          const msg =
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'خطا در دریافت اطلاعات';
          setState({ status: 'error', data: null, error: msg });
        }
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cancelRef.current = false;
    fetcherRef.current()
      .then((data) => {
        if (!cancelRef.current) setState({ status: 'success', data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelRef.current) {
          const msg =
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'خطا در دریافت اطلاعات';
          setState({ status: 'error', data: null, error: msg });
        }
      });
    return () => { cancelRef.current = true; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, refetch };
}
