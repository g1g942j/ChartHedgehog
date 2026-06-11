import { setSessionUser } from '@/shared/auth/session';

export type LoginResponse = {
    message: string;
    username: string;
    role: string;
};

export async function loginUser(data: {
    username: string;
    password: string;
}): Promise<LoginResponse> {
    const username = data.username.trim();
    if (!username || !data.password) {
        throw new Error('Введите логин и пароль');
    }

    setSessionUser({
        id: 1,
        username,
        email: `${username}@local.dev`,
        role: 'USER',
        fullName: username,
    });

    return {
        message: 'Вход выполнен (локальный режим)',
        username,
        role: 'USER',
    };
}
