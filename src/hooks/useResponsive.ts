import { useState, useEffect } from 'react';

interface ResponsiveState {
  isMobile: boolean;
  isDesktop: boolean;
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;
}

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export const useResponsive = (): ResponsiveState => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    handleResize();

    // Add resize listener with debounce
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', debouncedResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  const isMobile = screenSize.width <= MOBILE_BREAKPOINT;
  const isTablet = screenSize.width > MOBILE_BREAKPOINT && screenSize.width <= TABLET_BREAKPOINT;
  const isDesktop = screenSize.width > TABLET_BREAKPOINT;

  return {
    isMobile,
    isDesktop,
    isTablet,
    screenWidth: screenSize.width,
    screenHeight: screenSize.height,
  };
};

export default useResponsive;