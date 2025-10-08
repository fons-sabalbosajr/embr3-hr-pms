import React, { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { ConfigProvider, theme } from 'antd';
import axiosInstance from '../api/axiosInstance';
import tinycolor from 'tinycolor2';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  // User theme mode (light | dark)
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('theme') || 'light');
  // User-selected primary color preset (default uses app setting)
  const [userPrimaryPreset, setUserPrimaryPreset] = useState(localStorage.getItem('userPrimaryPreset') || 'default');
  const [appSettings, setAppSettings] = useState(null);
  // Option: apply user preset to header/sider (chrome)
  const [applyPresetToChrome, setApplyPresetToChrome] = useState(() => {
    const stored = localStorage.getItem('applyPresetToChrome');
    return stored === null ? true : stored === 'true';
  });

  const setTheme = (newTheme) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setPrimaryPreset = (preset) => {
    setUserPrimaryPreset(preset);
    localStorage.setItem('userPrimaryPreset', preset);
  };

  const applyCssVars = useCallback((settings) => {
    // Base content variables per mode
  const isDark = (localStorage.getItem('theme') || 'light') === 'dark';
  // Align with Ant Design default dark theme tokens
  // colorBgLayout ≈ #0a0a0a, colorBgContainer ≈ #141414, text ≈ rgba(255,255,255,0.85)
  const contentBg = isDark ? '#0a0a0a' : '#f5f5f5';
  const surfaceBg = isDark ? '#141414' : '#ffffff';
  const textColor = isDark ? 'rgba(255,255,255,0.85)' : '#141414';
  const mutedText = isDark ? 'rgba(255,255,255,0.65)' : '#595959';
    const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    const surfaceHover = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

    document.documentElement.style.setProperty('--app-content-bg', contentBg);
    document.documentElement.style.setProperty('--app-surface-bg', surfaceBg);
    document.documentElement.style.setProperty('--app-text-color', textColor);
    document.documentElement.style.setProperty('--app-text-muted', mutedText);
    document.documentElement.style.setProperty('--app-border-color', borderColor);
    document.documentElement.style.setProperty('--app-surface-hover-bg', surfaceHover);

    let header = settings?.general?.headerColor;
    let sider = settings?.general?.siderColor;
    // If user wants preset applied to chrome, derive from primary preset (if set)
    if (applyPresetToChrome) {
      const presetMap = {
        blue: '#1677ff', green: '#52c41a', purple: '#722ed1', yellow: '#fadb14', red: '#ff4d4f', orange: '#fa8c16', cyan: '#13c2c2', magenta: '#eb2f96', geekblue: '#2f54eb', gold: '#faad14', lime: '#a0d911',
      };
      const preset = presetMap[userPrimaryPreset];
      if (preset) {
        // Use variations of the preset for header/sider to ensure contrast
        header = tinycolor(preset).toHexString();
        sider = tinycolor(preset).darken(25).toHexString();
      }
    }

    if (header) {
      const h = tinycolor(header);
      const headerFg = h.isLight() ? '#000000' : '#ffffff';
      document.documentElement.style.setProperty('--app-header-bg', h.toHexString());
      document.documentElement.style.setProperty('--app-header-fg', headerFg);
    }
    if (sider) {
      const s = tinycolor(sider);
      const siderFg = s.isLight() ? '#000000' : '#ffffff';
      const hoverBg = s.isLight() ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)';
      const selectedBg = s.isLight() ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
      const subMenuBg = s.clone().darken(8).toHexString(); // ensure submenu is darker than sider
      // Make sider trigger slightly lighter than the sider background
      const triggerBg = s.clone().lighten(8).toHexString();
      const triggerHoverBg = s.clone().lighten(12).toHexString();
      document.documentElement.style.setProperty('--app-sider-bg', s.toHexString());
      document.documentElement.style.setProperty('--app-sider-fg', siderFg);
      document.documentElement.style.setProperty('--app-menu-bg', s.toHexString());
      document.documentElement.style.setProperty('--app-submenu-bg', subMenuBg);
      document.documentElement.style.setProperty('--app-menu-item-color', siderFg);
      document.documentElement.style.setProperty('--app-menu-item-hover-bg', hoverBg);
      document.documentElement.style.setProperty('--app-menu-item-selected-bg', selectedBg);
      document.documentElement.style.setProperty('--app-sider-trigger-bg', triggerBg);
      document.documentElement.style.setProperty('--app-sider-trigger-hover-bg', triggerHoverBg);
    }
  }, [applyPresetToChrome, userPrimaryPreset]);

  // Load settings from backend (requires auth). This will run once the axiosInstance has Authorization set by AuthContext.
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await axiosInstance.get('/settings');
        if (!mounted) return;
        setAppSettings(res.data);
        applyCssVars(res.data);
      } catch (e) {
        // Non-fatal if not available yet (e.g., not authenticated)
      }
    };
    load();
    // Listen for updates from DevSettings to re-apply immediately
    const onUpdated = () => load();
    window.addEventListener('app-settings-updated', onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('app-settings-updated', onUpdated);
    };
  }, [applyCssVars]);

  // Update content variables when mode changes
  useEffect(() => {
    if (appSettings) applyCssVars(appSettings);
  }, [currentTheme]);

  // Re-apply CSS vars when user changes preset or apply-to-chrome without refetching
  useEffect(() => {
    if (appSettings) {
      applyCssVars(appSettings);
    }
  }, [applyPresetToChrome, userPrimaryPreset]);

  const antdTheme = useMemo(() => {
    // Preset primary color palette
    const presetMap = {
      default: undefined,
      blue: '#1677ff',
      green: '#52c41a',
      purple: '#722ed1',
      yellow: '#fadb14',
      red: '#ff4d4f',
      orange: '#fa8c16',
      cyan: '#13c2c2',
      magenta: '#eb2f96',
      geekblue: '#2f54eb',
      gold: '#faad14',
      lime: '#a0d911',
    };
    const base = (() => {
      switch (currentTheme) {
        case 'dark':
          return { algorithm: theme.darkAlgorithm };
        case 'compact':
          return { algorithm: theme.compactAlgorithm };
        default:
          return { algorithm: theme.defaultAlgorithm };
      }
    })();
    const userPrimary = presetMap[userPrimaryPreset];
    const colorPrimary = userPrimary || appSettings?.general?.themeColor;
    return colorPrimary ? { ...base, token: { colorPrimary } } : base;
  }, [currentTheme, userPrimaryPreset, appSettings]);

  const value = {
    theme: currentTheme,
    setTheme,
    appSettings,
    userPrimaryPreset,
    setUserPrimaryPreset: setPrimaryPreset,
    applyPresetToChrome,
    setApplyPresetToChrome: (v) => { setApplyPresetToChrome(v); localStorage.setItem('applyPresetToChrome', String(v)); },
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
