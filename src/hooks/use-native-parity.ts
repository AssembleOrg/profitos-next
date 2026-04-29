'use client';
import { useEffect } from 'react';

export const useNativeParity = () => {
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(target.tagName) ||
        target.isContentEditable ||
        !!target.closest('button');
      if (!isInteractive && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => window.removeEventListener('touchstart', handleTouchStart);
  }, []);
};
