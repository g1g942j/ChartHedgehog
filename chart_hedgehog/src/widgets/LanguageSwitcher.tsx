'use client';

import Image from 'next/image';

import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';
import MuiSelect from '@mui/material/Select';

import type { Locale } from '@/shared/i18n';
import { appTranslations, useLocale } from '@/shared/i18n';

import styles from './LanguageSwitcher.module.scss';

const localeOptions: { value: Locale; flagSrc: string }[] = [
    { value: 'ru', flagSrc: '/languages/Russia.svg' },
    { value: 'en', flagSrc: '/languages/English.svg' },
];

type LanguageFlagProps = {
    src: string;
};

function LanguageFlag({ src }: LanguageFlagProps) {
    return (
        <Image
            src={src}
            alt=""
            width={20}
            height={14}
            className={styles.LanguageSwitcher_flag}
        />
    );
}

export type LanguageSwitcherProps = {
    flagOnly?: boolean;
    showCode?: boolean;
};

export function LanguageSwitcher(props: LanguageSwitcherProps) {
    const { flagOnly = false, showCode = false } = props;
    const { locale, setLocale, t } = useLocale();

    const handleChange = (event: SelectChangeEvent<Locale>) => {
        setLocale(event.target.value as Locale);
    };

    const currentFlagSrc =
        localeOptions.find((option) => option.value === locale)?.flagSrc ??
        '/languages/Russia.svg';

    return (
        <MuiSelect
            value={locale}
            onChange={handleChange}
            variant="outlined"
            className={[
                styles.LanguageSwitcher,
                flagOnly ? styles.LanguageSwitcher_flagOnly : '',
            ]
                .filter(Boolean)
                .join(' ')}
            MenuProps={{
                slotProps: {
                    paper: {
                        className: styles.LanguageSwitcher_menu,
                    },
                },
            }}
            renderValue={() => (
                showCode ? (
                    <span className={styles.LanguageSwitcher_value}>
                        {locale.toUpperCase()}
                    </span>
                ) : (
                    <span className={styles.LanguageSwitcher_value}>
                        <LanguageFlag src={currentFlagSrc} />
                        {!flagOnly ? (
                            <span className={styles.LanguageSwitcher_label}>
                                {t.languageName}
                            </span>
                        ) : null}
                    </span>
                )
            )}
        >
            {localeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                    <LanguageFlag src={option.flagSrc} />
                    <span className={styles.LanguageSwitcher_label}>
                        {appTranslations[option.value].languageName}
                    </span>
                </MenuItem>
            ))}
        </MuiSelect>
    );
}
