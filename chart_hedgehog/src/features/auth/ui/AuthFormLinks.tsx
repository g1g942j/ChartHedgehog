'use client';

import Link from 'next/link';

import { Typography } from '@/shared/ui/Typography';

import styles from './AuthFormLinks.module.scss';

type AuthLink = {
    href: string;
    label: string;
};

type AuthFormLinksProps = {
    links: AuthLink[];
};

export function AuthFormLinks(props: AuthFormLinksProps) {
    const { links } = props;

    return (
        <nav className={styles.Links} aria-label="Навигация по формам авторизации">
            {links.map((link) => (
                <Link key={link.href} href={link.href} className={styles.Link}>
                    <Typography variant="body2" component="span">
                        {link.label}
                    </Typography>
                </Link>
            ))}
        </nav>
    );
}
