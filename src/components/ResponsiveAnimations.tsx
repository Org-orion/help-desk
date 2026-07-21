import React, { useEffect, useState } from 'react';
import { useResponsiveContext } from './ResponsiveLayout';

interface ResponsiveTransitionProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export const ResponsiveTransition: React.FC<ResponsiveTransitionProps> = ({ 
  children, 
  className = '', 
  duration = 300 
}) => {
  const { isMobile } = useResponsiveContext();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    return () => setIsVisible(false);
  }, []);

  return (
    <div 
      className={`transition-all duration-${duration} ease-in-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface CardAnimationProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const CardAnimation: React.FC<CardAnimationProps> = ({ 
  children, 
  delay = 0, 
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div 
      className={`transition-all duration-500 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface HamburgerAnimationProps {
  isOpen: boolean;
  children: React.ReactNode;
}

export const HamburgerAnimation: React.FC<HamburgerAnimationProps> = ({ 
  isOpen, 
  children 
}) => {
  return (
    <div 
      className={`transition-all duration-300 ease-in-out transform ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      {children}
    </div>
  );
};

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({ 
  children, 
  delay = 0, 
  duration = 300, 
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div 
      className={`transition-opacity duration-${duration} ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface SlideInProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
}

export const SlideIn: React.FC<SlideInProps> = ({ 
  children, 
  direction = 'up', 
  delay = 0, 
  duration = 400, 
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const getTransform = () => {
    switch (direction) {
      case 'left': return 'translate-x-8';
      case 'right': return '-translate-x-8';
      case 'up': return 'translate-y-8';
      case 'down': return '-translate-y-8';
      default: return 'translate-y-8';
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div 
      className={`transition-all duration-${duration} ease-out transform ${
        isVisible ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${getTransform()}`
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default {
  ResponsiveTransition,
  CardAnimation,
  HamburgerAnimation,
  FadeIn,
  SlideIn
};