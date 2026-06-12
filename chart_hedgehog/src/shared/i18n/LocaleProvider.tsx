'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { appTranslations } from './translations';
import type { AppTranslations, Locale } from './types';

const STORAGE_KEY = 'ChartHedgehog_locale';
const DEFAULT_LOCALE: Locale = 'ru';

type LocaleContextValue = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: AppTranslations;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

type LocaleProviderProps = {
    children: React.ReactNode;
};

function readStoredLocale(): Locale {
    if (typeof window === 'undefined') {
        return DEFAULT_LOCALE;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'ru' ? stored : DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

    useEffect(() => {
        document.documentElement.lang = locale;
        window.localStorage.setItem(STORAGE_KEY, locale);
    }, [locale]);

    const setLocale = useCallback((nextLocale: Locale) => {
        setLocaleState(nextLocale);
    }, []);

    const value = useMemo(
        () => ({
            locale,
            setLocale,
            t: appTranslations[locale],
        }),
        [locale, setLocale],
    );

    return (
        <LocaleContext.Provider value={value}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    const context = useContext(LocaleContext);

    if (!context) {
        throw new Error('useLocale must be used within LocaleProvider');
    }

    return context;
}
