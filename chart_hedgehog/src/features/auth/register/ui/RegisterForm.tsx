'use client';

import { AuthFormAlerts } from '@/features/auth/ui/AuthFormAlerts';
import { AuthFormLinks } from '@/features/auth/ui/AuthFormLinks';
import { AuthPageLayout } from '@/features/auth/ui/AuthPageLayout';
import { Form, FormTextField } from '@/shared/form';
import { useLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

import formStyles from '../../ui/authForm.module.scss';

import { useRegisterForm } from '../model/useRegisterForm';

export function RegisterForm() {
    const { methods, isPending, onSubmit, submitError, successMessage } =
        useRegisterForm();
    const { t } = useLocale();

    return (
        <AuthPageLayout
            title={t.auth.registerTitle}
            footer={
                <AuthFormLinks
                    links={[
                        {
                            href: '/',
                            prefix: t.auth.loginPrompt,
                            label: t.auth.loginAction,
                        },
                    ]}
                />
            }
        >
            <AuthFormAlerts
                submitError={submitError}
                successMessage={successMessage}
            />
            <Form
                methods={methods}
                onSubmit={onSubmit}
                className={formStyles.Form}
            >
                <FormTextField
                    name="username"
                    label={t.auth.usernameLabel}
                    autoComplete="username"
                />
                <FormTextField
                    name="email"
                    label={t.auth.emailLabel}
                    type="email"
                    autoComplete="email"
                />
                <FormTextField
                    name="password"
                    label={t.auth.passwordLabel}
                    type="password"
                    autoComplete="new-password"
                />
                <FormTextField
                    name="confirmPassword"
                    label={t.auth.confirmPasswordLabel}
                    type="password"
                    autoComplete="new-password"
                />
                <FormTextField
                    name="fullName"
                    label={t.auth.fullNameLabel}
                    autoComplete="name"
                />
                <Button
                    type="submit"
                    variant="contained"
                    loading={isPending}
                    fullWidth
                >
                    {t.auth.registerButton}
                </Button>
            </Form>
        </AuthPageLayout>
    );
}
