'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { type SubmitHandler, useForm } from 'react-hook-form';

import { registerUser } from '../api/register';
import {
    type RegisterFormValues,
    registerSchema,
} from './registerSchema';

export function useRegisterForm() {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const methods = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
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
            setSuccessMessage(`${response.message} Перенаправление на вход...`);
            methods.reset();
            setTimeout(() => router.push('/'), 1500);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Не удалось зарегистрироваться';
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
