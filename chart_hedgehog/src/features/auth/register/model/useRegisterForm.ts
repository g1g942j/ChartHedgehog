'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { type SubmitHandler, useForm } from 'react-hook-form';

import { useLocale } from '@/shared/i18n';

import { registerUser } from '../api/register';
import {
    createRegisterSchema,
    type RegisterFormValues,
} from './registerSchema';

export function useRegisterForm() {
    const router = useRouter();
    const { t } = useLocale();
    const [isPending, setIsPending] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const schema = useMemo(
        () => createRegisterSchema(t.auth.validation),
        [t.auth.validation],
    );

    const methods = useForm<RegisterFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
            fullName: '',
        },
    });

    const onSubmit: SubmitHandler<RegisterFormValues> = async (data) => {
        setIsPending(true);
        setSubmitError(null);
        setSuccessMessage(null);

        try {
            const response = await registerUser(data);
            setSuccessMessage(`${response.message} ${t.auth.redirectToLogin}`);
            methods.reset();
            setTimeout(() => router.push('/'), 1500);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t.auth.registerFallbackError;
            setSubmitError(message);
        } finally {
            setIsPending(false);
        }
    };

    return {
        methods,
        isPending,
        onSubmit,
        submitError,
        successMessage,
    };
}
