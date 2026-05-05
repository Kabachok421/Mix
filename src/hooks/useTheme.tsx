import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'ocean';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  // Kept for backward compatibility if needed in some places, but we should migrate to `theme`
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'ocean' || saved === 'dark' || saved === 'light') return saved as Theme;
    
    // Fallback to old darkMode value
    const savedDark = localStorage.getItem('darkMode');
    if (savedDark === 'true') return 'dark';
    return 'light';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'ocean');
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'ocean') {
      root.classList.add('dark', 'ocean'); // Ocean inherits dark mode text colors via `dark` class, plus custom ocean overrides
    }
    
    localStorage.setItem('darkMode', String(theme === 'dark' || theme === 'ocean'));
  }, [theme]);

  // Backward compatible toggle
  const toggleDarkMode = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkMode: theme !== 'light', toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
