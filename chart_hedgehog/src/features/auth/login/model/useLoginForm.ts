'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { type SubmitHandler, useForm } from 'react-hook-form';

import { useLocale } from '@/shared/i18n';

import { loginUser } from '../api/login';
import { createLoginSchema, type LoginFormValues } from './loginSchema';

export function useLoginForm() {
    const router = useRouter();
    const { t } = useLocale();
    const [isPending, setIsPending] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const schema = useMemo(
        () => createLoginSchema(t.auth.validation),
        [t.auth.validation],
    );

    const methods = useForm<LoginFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit: SubmitHandler<LoginFormValues> = async (data) => {
        setIsPending(true);
        setSubmitError(null);

        try {
            await loginUser(data);
            router.push('/diagrams');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : t.auth.loginFallbackError;
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
    };
}
