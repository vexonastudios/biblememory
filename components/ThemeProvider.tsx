'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/store/settingsStore';

export default function ThemeProvider() {
  const theme = useSettingsStore((s) => s.theme) || 'light';

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (currentTheme: 'light' | 'dark' | 'system') => {
      root.classList.remove('dark-theme');
      
      if (currentTheme === 'dark') {
        root.classList.add('dark-theme');
      } else if (currentTheme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemDark) {
          root.classList.add('dark-theme');
        }
      }
    };

    applyTheme(theme);

    // If it's system theme, listen to changes in OS preferences
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      
      // Modern browsers
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return null;
}
