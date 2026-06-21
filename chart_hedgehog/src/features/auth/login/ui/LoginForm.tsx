'use client';

import { AuthFormAlerts } from '@/features/auth/ui/AuthFormAlerts';
import { AuthFormLinks } from '@/features/auth/ui/AuthFormLinks';
import { AuthPageLayout } from '@/features/auth/ui/AuthPageLayout';
import { Form, FormTextField } from '@/shared/form';
import { useLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

import formStyles from '../../ui/authForm.module.scss';

import { useLoginForm } from '../model/useLoginForm';

export function LoginForm() {
    const { methods, isPending, onSubmit, submitError } = useLoginForm();
    const { t } = useLocale();

    return (
        <AuthPageLayout
            title={t.auth.loginTitle}
            footer={
                <AuthFormLinks
                    links={[
                        {
                            href: '/register',
                            prefix: t.auth.registerPrompt,
                            label: t.auth.registerAction,
                        },
                    ]}
                />
            }
        >
            <AuthFormAlerts submitError={submitError} />
            <Form
                methods={methods}
                onSubmit={onSubmit}
                className={formStyles.Form}
            >
                <FormTextField
                    name="username"
                    label={t.auth.usernameLabel}
                    type="text"
                    autoComplete="username"
                />
                <FormTextField
                    name="password"
                    label={t.auth.passwordLabel}
                    type="password"
                    autoComplete="current-password"
                />
                <Button
                    type="submit"
                    variant="contained"
                    loading={isPending}
                    fullWidth
                >
                    {t.auth.loginButton}
                </Button>
                <p style={{ margin: '4px 0 0', fontSize: 13, textAlign: 'center', color: 'var(--text-secondary, #888)' }}>
                    {t.auth.forgotPassword}
                </p>
            </Form>
        </AuthPageLayout>
    );
}
