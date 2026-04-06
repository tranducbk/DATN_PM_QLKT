'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks whether viewport width is at or below the given breakpoint.
 * @param breakpoint - Maximum width in pixels considered mobile
 * @returns `true` when current viewport matches mobile breakpoint
 */
export function useMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}

// Alias kept for compatibility with existing imports.
export const useIsMobile = useMobile;
