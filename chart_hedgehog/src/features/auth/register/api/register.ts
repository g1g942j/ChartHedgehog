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

    return {
        message: 'Регистрация завершена (локальный режим, без бэкенда)',
        username,
        email,
    };
}
