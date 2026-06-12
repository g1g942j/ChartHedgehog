import { setSessionUser } from '@/shared/auth/session';

export type LoginResponse = {
    message: string;
    username: string;
    role: string;
};

export async function loginUser(data: {
    email: string;
    password: string;
}): Promise<LoginResponse> {
    const email = data.email.trim();
    if (!email || !data.password) {
        throw new Error('Введите email и пароль');
    }
    const username = email.split('@')[0] || email;

    setSessionUser({
        id: 1,
        username,
        email,
        role: 'USER',
        fullName: username,
    });

    return {
        message: 'Вход выполнен (локальный режим)',
        username,
        role: 'USER',
    };
}
