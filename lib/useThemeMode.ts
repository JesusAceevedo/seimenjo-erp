import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'seimenjo-theme';

export function useThemeMode(defaultMode = true) {
  // Initialize with a default value to prevent hydration mismatches
  const [isDarkMode, setIsDarkMode] = useState(defaultMode);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Sync state with localStorage once mounted on client
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      setIsDarkMode(saved === 'dark');
    }
    setHasLoaded(true);
  }, []);

  // Sync className and style on documentElement when state changes
  useEffect(() => {
    if (!hasLoaded) return;
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, hasLoaded]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return { isDarkMode, setIsDarkMode, toggleDarkMode };
}

