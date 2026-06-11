'use client';

import { Alert } from '@/shared/ui/Alert';

import styles from './AuthFormAlerts.module.scss';

type AuthFormAlertsProps = {
    submitError?: string | null;
    successMessage?: string | null;
};

export function AuthFormAlerts(props: AuthFormAlertsProps) {
    const { submitError, successMessage } = props;

    return (
        <>
            {submitError ? (
                <Alert severity="error" className={styles.Alert}>
                    {submitError}
                </Alert>
            ) : null}
            {successMessage ? (
                <Alert severity="success" className={styles.Alert}>
                    {successMessage}
                </Alert>
            ) : null}
        </>
    );
}
