import { apiFetch } from '@/shared/api/client';

import type { RegisterFormValues } from '../model/registerSchema';

export type RegisterResponse = {
    message: string;
    username: string;
    email: string;
};

export async function registerUser(
    data: RegisterFormValues,
): Promise<RegisterResponse> {
    const username = data.username.trim();
    const email = data.email.trim();

    if (!username || !email || !data.password) {
        throw new Error('Заполните обязательные поля');
    }

    return apiFetch<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            username,
            email,
            password: data.password,
            fullName: data.fullName?.trim() || undefined,
        }),
    });
}
