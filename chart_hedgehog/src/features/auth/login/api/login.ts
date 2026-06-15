import { API_BASE_URL, ApiError } from '@/shared/api/client';
import { setSessionUser } from '@/shared/auth/session';

export type LoginResponse = {
    message: string;
    username: string;
    role: string;
};

type CurrentUserResponse = {
    username: string;
    email: string;
    role: string;
    fullName?: string | null;
};

export async function loginUser(data: {
    username: string;
    password: string;
}): Promise<LoginResponse> {
    const username = data.username.trim();
    if (!username || !data.password) {
        throw new Error('Введите email и пароль');
    }
    
    const params = new URLSearchParams({
        username,
        password: data.password,
    });
 
    const loginResponse = await fetch(
        `${API_BASE_URL}/api/auth/login?${params.toString()}`,
        {
            method: 'POST',
            credentials: 'include',
        },
    );
 
    if (!loginResponse.ok) {
        let message = 'Неверные имя пользователя или пароль';
        try {
            const body = await loginResponse.json();
            if (body && typeof body.error === 'string') {
                message = body.error;
            }
        } catch {
            
        }
        throw new ApiError(message, loginResponse.status);
    }
 
    const meResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
    });
 
    if (!meResponse.ok) {
        throw new ApiError('Не удалось получить данные пользователя', meResponse.status);
    }
 
    const me: CurrentUserResponse = await meResponse.json();

    setSessionUser({
        id: 0,
        username: me.username,
        email: me.email,
        role: me.role,
        fullName: me.fullName,
    });
 
    return {
        message: 'Вход выполнен',
        username: me.username,
        role: me.role,
    };
}
