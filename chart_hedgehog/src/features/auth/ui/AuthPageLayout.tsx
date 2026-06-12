'use client';

import Image from 'next/image';

import type { PropsWithChildren, ReactNode } from 'react';

import { AppControls } from '@/widgets/AppControls';
import { Typography } from '@/shared/ui/Typography';

import styles from './AuthPageLayout.module.scss';

type AuthPageLayoutProps = PropsWithChildren<{
    title: string;
    footer?: ReactNode;
}>;

export function AuthPageLayout(props: AuthPageLayoutProps) {
    const { title, children, footer } = props;

    return (
        <section className={styles.AuthPage}>
            <div className={styles.Controls}>
                <AppControls />
            </div>
            <div className={styles.Card}>
                <Typography variant="h4" component="h1" className={styles.Title}>
                    {title}
                </Typography>
                {children}
                {footer ? <div className={styles.Footer}>{footer}</div> : null}
            </div>
            <div className={styles.Banner}>
                <Image
                    src="/LoginBanner.svg"
                    alt=""
                    width={480}
                    height={360}
                    priority
                />
            </div>
        </section>
    );
}
