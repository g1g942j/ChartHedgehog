'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { type SubmitHandler, useForm } from 'react-hook-form';

import { loginUser } from '../api/login';
import { type LoginFormValues, loginSchema } from './loginSchema';

export function useLoginForm() {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const methods = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: '',
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
                error instanceof Error ? error.message : 'Не удалось войти';
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
