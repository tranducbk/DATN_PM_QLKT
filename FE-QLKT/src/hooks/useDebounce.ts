import { useEffect, useState } from 'react';

/** Standard debounce delay (ms) for search inputs across the app. */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Debounce a changing value — returns the latest value only after it stops changing for `delay` ms.
 * @param value - The value to debounce (e.g. a search keyword)
 * @param delay - Debounce delay in ms (defaults to SEARCH_DEBOUNCE_MS)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debouncedValue;
}
