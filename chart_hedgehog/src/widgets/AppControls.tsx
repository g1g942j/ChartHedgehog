'use client';

import styles from './AppControls.module.scss';

import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

export function AppControls() {
    return (
        <div className={styles.Controls}>
            <LanguageSwitcher />
            <ThemeToggle />
        </div>
    );
}
