'use client';

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseFetchOptions {
  /** Hiển thị toast error tự động, default: true */
  showError?: boolean;
  /** Message khi fetch thất bại */
  errorMessage?: string;
  /** Tự động fetch khi mount, default: true */
  immediate?: boolean;
}

/**
 * useFetch - Custom Hook Pattern
 *
 * Thay thế pattern useState/useEffect/try-catch lặp lại 20+ lần trong codebase.
 *
 * Before:
 * ```
 * const [data, setData] = useState(null);
 * const [loading, setLoading] = useState(true);
 * useEffect(() => {
 *   const fetch = async () => {
 *     try {
 *       setLoading(true);
 *       const res = await apiClient.getPersonnel();
 *       if (res.success) setData(res.data);
 *     } catch { message.error('...') }
 *     finally { setLoading(false) }
 *   };
 *   fetch();
 * }, []);
 * ```
 *
 * After:
 * ```
 * const { data, loading, refetch } = useFetch(() => apiClient.getPersonnel());
 * ```
 */
export function useFetch<T = any>(
  fetcher: () => Promise<{ success: boolean; data?: T; message?: string }>,
  deps: any[] = [],
  options: UseFetchOptions = {}
) {
  const { showError = true, errorMessage, immediate = true } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetcher();
      if (res.success) {
        setState({ data: res.data ?? null, loading: false, error: null });
      } else {
        const errMsg = res.message || errorMessage || 'Lấy dữ liệu thất bại';
        setState({ data: null, loading: false, error: errMsg });
        if (showError) message.error(errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || errorMessage || 'Lỗi hệ thống';
      setState({ data: null, loading: false, error: errMsg });
      if (showError) message.error(errMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return {
    ...state,
    refetch: execute,
  };
}

/**
 * useMutation - Hook cho các thao tác CUD (Create, Update, Delete)
 *
 * ```
 * const { execute, loading } = useMutation(
 *   (data) => apiClient.createPersonnel(data),
 *   { successMessage: 'Tạo thành công' }
 * );
 * ```
 */
export function useMutation<TInput = any, TOutput = any>(
  mutator: (input: TInput) => Promise<{ success: boolean; data?: TOutput; message?: string }>,
  options: {
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (data: TOutput) => void;
    onError?: (error: string) => void;
  } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (input: TInput) => {
      setLoading(true);
      setError(null);
      try {
        const res = await mutator(input);
        if (res.success) {
          if (options.successMessage) message.success(options.successMessage);
          options.onSuccess?.(res.data as TOutput);
          return res;
        } else {
          const errMsg = res.message || options.errorMessage || 'Thao tác thất bại';
          setError(errMsg);
          message.error(errMsg);
          options.onError?.(errMsg);
          return res;
        }
      } catch (err: any) {
        const errMsg = err?.message || options.errorMessage || 'Lỗi hệ thống';
        setError(errMsg);
        message.error(errMsg);
        options.onError?.(errMsg);
        return { success: false, message: errMsg };
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutator]
  );

  return { execute, loading, error };
}
