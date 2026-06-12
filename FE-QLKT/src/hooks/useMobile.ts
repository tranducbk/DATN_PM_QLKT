'use client';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  useMobile — responsive hook detect màn hình nhỏ (< 768px)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  PATTERN:
 *  - Subscribe window.matchMedia → re-render khi cross breakpoint.
 *  - Cleanup listener trong useEffect return → tránh leak.
 *
 *  WHY KHÔNG dùng window.innerWidth trực tiếp:
 *  - innerWidth không reactive → component không re-render khi resize.
 *  - matchMedia có addEventListener('change') → trigger render.
 *
 *  SSR-SAFE: check typeof window trước khi access matchMedia.
 *  Initial state false → SSR render desktop layout, client hydrate → update.
 *
 *  BREAKPOINT 768px: match Tailwind `md:` để đồng bộ với CSS.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
