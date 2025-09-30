import React, { createContext, useState, useContext, useMemo } from 'react';
import { ConfigProvider, theme } from 'antd';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('theme') || 'light');

  const setTheme = (newTheme) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const antdTheme = useMemo(() => {
    switch (currentTheme) {
      case 'dark':
        return { algorithm: theme.darkAlgorithm };
      case 'compact':
        return { algorithm: theme.compactAlgorithm };
      default:
        return { algorithm: theme.defaultAlgorithm };
    }
  }, [currentTheme]);

  const value = {
    theme: currentTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
