'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';

type ThemeMode = 'light' | 'dark';

type ThemeModeContextValue = {
    mode: ThemeMode;
    toggleMode: () => void;
};

const STORAGE_KEY = 'ChartHedgehog_theme';
const DEFAULT_MODE: ThemeMode = 'dark';
const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

type ThemeModeProviderProps = {
    children: React.ReactNode;
};

function readStoredMode(): ThemeMode {
    if (typeof window === 'undefined') {
        return DEFAULT_MODE;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_MODE;
}

export function ThemeModeProvider({ children }: ThemeModeProviderProps) {
    const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);

    useEffect(() => {
        setMode(readStoredMode());
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-light', 'theme-dark');
        root.classList.add(`theme-${mode}`);
        window.localStorage.setItem(STORAGE_KEY, mode);
    }, [mode]);

    const toggleMode = useCallback(() => {
        setMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark'));
    }, []);

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    primary: {
                        main: '#ff9f43',
                    },
                    background: {
                        default: mode === 'dark' ? '#0f1722' : '#fefaf6',
                        paper: mode === 'dark' ? '#263141' : '#ffffff',
                    },
                    text: {
                        primary: mode === 'dark' ? '#e6eef8' : '#241a11',
                        secondary: mode === 'dark' ? '#9fb0c5' : '#7b6755',
                    },
                },
                shape: {
                    borderRadius: 12,
                },
            }),
        [mode],
    );

    const value = useMemo(
        () => ({
            mode,
            toggleMode,
        }),
        [mode, toggleMode],
    );

    return (
        <ThemeModeContext.Provider value={value}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
}

export function useThemeMode() {
    const context = useContext(ThemeModeContext);

    if (!context) {
        throw new Error('useThemeMode must be used within ThemeModeProvider');
    }

    return context;
}
