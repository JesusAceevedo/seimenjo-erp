import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'seimenjo-theme';

export function useThemeMode(defaultMode = true) {
  // Initializar el modo oscuro leyendo del almacenamiento o usando el valor por defecto
  const initialMode = (() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved === 'dark';
      }
    }
    return defaultMode;
  })();
  const [isDarkMode, setIsDarkMode] = useState(initialMode);

  // Efecto solo para sincronizar la clase y el atributo de colorScheme con el estado
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    // Guardamos la preferencia para futuras visitas
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

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
