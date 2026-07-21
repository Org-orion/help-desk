import React, { createContext, useContext } from 'react';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveContextType {
  isMobile: boolean;
  isDesktop: boolean;
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;
}

const ResponsiveContext = createContext<ResponsiveContextType | undefined>(undefined);

export const useResponsiveContext = () => {
  const context = useContext(ResponsiveContext);
  if (!context) {
    throw new Error('useResponsiveContext must be used within a ResponsiveLayout');
  }
  return context;
};

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({ 
  children, 
  className = '' 
}) => {
  const responsive = useResponsive();

  return (
    <ResponsiveContext.Provider value={responsive}>
      <div 
        className={`responsive-layout ${className}`}
        data-device={responsive.isMobile ? 'mobile' : responsive.isTablet ? 'tablet' : 'desktop'}
        data-screen-width={responsive.screenWidth}
      >
        {children}
      </div>
    </ResponsiveContext.Provider>
  );
};

export default ResponsiveLayout;