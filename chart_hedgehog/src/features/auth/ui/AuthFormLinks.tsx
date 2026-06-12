'use client';

import Link from 'next/link';

import { useLocale } from '@/shared/i18n';
import { Typography } from '@/shared/ui/Typography';

import styles from './AuthFormLinks.module.scss';

type AuthLink = {
    href: string;
    label: string;
    prefix?: string;
};

type AuthFormLinksProps = {
    links: AuthLink[];
};

export function AuthFormLinks(props: AuthFormLinksProps) {
    const { links } = props;
    const { t } = useLocale();

    return (
        <nav className={styles.Links} aria-label={t.auth.navigationLabel}>
            {links.map((link) => (
                <Typography key={link.href} variant="body2" component="span">
                    {link.prefix ? `${link.prefix} ` : null}
                    <Link href={link.href} className={styles.Link}>
                        {link.label}
                    </Link>
                </Typography>
            ))}
        </nav>
    );
}
