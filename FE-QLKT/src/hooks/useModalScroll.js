import { useEffect } from 'react';

/**
 * Hook đơn giản để disable scroll khi modal mở
 * @param {boolean} isOpen - Trạng thái modal có đang mở hay không
 */
export const useModalScroll = isOpen => {
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = 'unset';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);
};
