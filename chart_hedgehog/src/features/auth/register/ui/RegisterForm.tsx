'use client';

import { AuthFormAlerts } from '@/features/auth/ui/AuthFormAlerts';
import { AuthFormLinks } from '@/features/auth/ui/AuthFormLinks';
import { AuthPageLayout } from '@/features/auth/ui/AuthPageLayout';
import { Form, FormTextField } from '@/shared/form';
import { Button } from '@/shared/ui/Button';

import formStyles from '../../ui/authForm.module.scss';

import { useRegisterForm } from '../model/useRegisterForm';

export function RegisterForm() {
    const { methods, isPending, onSubmit, submitError, successMessage } =
        useRegisterForm();

    return (
        <AuthPageLayout
            title="Регистрация"
            footer={
                <AuthFormLinks
                    links={[
                        {
                            href: '/',
                            label: 'Уже есть аккаунт? Войти',
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
                    label="Имя пользователя"
                    autoComplete="username"
                />
                <FormTextField
                    name="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                />
                <FormTextField
                    name="password"
                    label="Пароль"
                    type="password"
                    autoComplete="new-password"
                />
                <FormTextField
                    name="confirmPassword"
                    label="Подтвердите пароль"
                    type="password"
                    autoComplete="new-password"
                />
                <FormTextField
                    name="fullName"
                    label="Полное имя"
                    autoComplete="name"
                />
                <Button
                    type="submit"
                    variant="contained"
                    loading={isPending}
                    fullWidth
                >
                    Зарегистрироваться
                </Button>
            </Form>
        </AuthPageLayout>
    );
}
