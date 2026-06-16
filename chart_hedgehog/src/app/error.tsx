'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import styles from './error.module.scss';

type ErrorPageProps = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
    useEffect(() => {
        console.error('[App Error]', error);
    }, [error]);

    return (
        <div className={styles.Page}>
            <div className={styles.Code}>500</div>
            <div className={styles.Title}>Что-то пошло не так</div>
            <div className={styles.Sub}>
                Произошла непредвиденная ошибка. Попробуйте обновить страницу.
            </div>
            {error.digest ? (
                <div className={styles.Digest}>ID ошибки: {error.digest}</div>
            ) : null}
            <div className={styles.Actions}>
                <button type="button" className={styles.BtnPrimary} onClick={reset}>
                    Попробовать снова
                </button>
                <Link href="/diagrams" className={styles.BtnSecondary}>
                    На главную
                </Link>
            </div>
        </div>
    );
}
