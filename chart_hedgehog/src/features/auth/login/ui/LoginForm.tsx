'use client';

import { AuthFormAlerts } from '@/features/auth/ui/AuthFormAlerts';
import { AuthFormLinks } from '@/features/auth/ui/AuthFormLinks';
import { AuthPageLayout } from '@/features/auth/ui/AuthPageLayout';
import { Form, FormTextField } from '@/shared/form';
import { Button } from '@/shared/ui/Button';

import formStyles from '../../ui/authForm.module.scss';

import { useLoginForm } from '../model/useLoginForm';

export function LoginForm() {
    const { methods, isPending, onSubmit, submitError } = useLoginForm();

    return (
        <AuthPageLayout
            title="Вход"
            footer={
                <AuthFormLinks
                    links={[
                        {
                            href: '/register',
                            label: 'Нет аккаунта? Зарегистрироваться',
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
                    label="Имя пользователя"
                    autoComplete="username"
                />
                <FormTextField
                    name="password"
                    label="Пароль"
                    type="password"
                    autoComplete="current-password"
                />
                <Button
                    type="submit"
                    variant="contained"
                    loading={isPending}
                    fullWidth
                >
                    Войти
                </Button>
            </Form>
        </AuthPageLayout>
    );
}
