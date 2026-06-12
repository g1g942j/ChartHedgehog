'use client';

import Image from 'next/image';

import { useLocale } from '@/shared/i18n';
import { useThemeMode } from '@/shared/theme';
import { Button } from '@/shared/ui/Button';

import styles from './ThemeToggle.module.scss';

export function ThemeToggle() {
    const { mode, toggleMode } = useThemeMode();
    const { t } = useLocale();
    const isDark = mode === 'dark';
    const nextThemeLabel = isDark
        ? t.common.theme.toggleToLight
        : t.common.theme.toggleToDark;

    return (
        <Button
            type="button"
            variant="outlined"
            size="small"
            className={styles.ThemeToggle}
            aria-label={nextThemeLabel}
            title={nextThemeLabel}
            onClick={toggleMode}
        >
            <Image
                src={isDark ? '/theme/moon.svg' : '/theme/sun.svg'}
                alt=""
                width={22}
                height={22}
            />
        </Button>
    );
}
