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

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', nextMode);
      document.documentElement.style.colorScheme = nextMode ? 'dark' : 'light';
    }
  };

  return { isDarkMode, setIsDarkMode, toggleDarkMode };
}
