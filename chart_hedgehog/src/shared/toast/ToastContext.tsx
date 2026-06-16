'use client';

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';

import type { PropsWithChildren } from 'react';

import styles from './Toast.module.scss';

// ─── types ────────────────────────────────────────────────────────────────────

type Severity = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
    id: string;
    message: string;
    severity: Severity;
};

export type ToastApi = {
    show: (message: string, severity?: Severity) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
};

// ─── context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastApi | null>(null);

// ─── provider ─────────────────────────────────────────────────────────────────

const DURATION = 4000;
const MAX_TOASTS = 5;

export function ToastProvider({ children }: PropsWithChildren) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counterRef = useRef(0);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const add = useCallback(
        (message: string, severity: Severity = 'info') => {
            const id = `toast-${++counterRef.current}`;
            setToasts((prev) => {
                const next = [...prev, { id, message, severity }];
                return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
            });
            setTimeout(() => dismiss(id), DURATION);
        },
        [dismiss],
    );

    const toast = useMemo<ToastApi>(() => ({
        show:    (m, s) => add(m, s),
        success: (m) => add(m, 'success'),
        error:   (m) => add(m, 'error'),
        info:    (m) => add(m, 'info'),
        warning: (m) => add(m, 'warning'),
    }), [add]);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {toasts.length > 0 ? (
                <div className={styles.Container} role="region" aria-label="Уведомления" aria-live="polite">
                    {toasts.map((t) => (
                        <div key={t.id} className={`${styles.Toast} ${styles[`Toast_${t.severity}`]}`}>
                            <span className={styles.Icon}>{ICONS[t.severity]}</span>
                            <span className={styles.Message}>{t.message}</span>
                            <button
                                type="button"
                                className={styles.Close}
                                aria-label="Закрыть"
                                onClick={() => dismiss(t.id)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
        </ToastContext.Provider>
    );
}

const ICONS: Record<Severity, string> = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
    warning: '⚠',
};

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
