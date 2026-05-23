import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'seimenjo-theme';

export function useThemeMode(defaultMode = true) {
  const [isDarkMode, setIsDarkMode] = useState(defaultMode);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === 'dark' || savedTheme === 'light') {
      const nextMode = savedTheme === 'dark';
      setIsDarkMode(nextMode);
      document.documentElement.classList.toggle('dark', nextMode);
      document.documentElement.style.colorScheme = nextMode ? 'dark' : 'light';
      return;
    }

    document.documentElement.classList.toggle('dark', defaultMode);
    document.documentElement.style.colorScheme = defaultMode ? 'dark' : 'light';
  }, [defaultMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((current) => !current);

  return { isDarkMode, setIsDarkMode, toggleDarkMode };
}
