import { apiFetch } from '@/shared/api/client';
import {
    clearSession,
    getSessionUser,
    type SessionUser,
    setSessionUser,
} from '@/shared/auth/session';

export type CurrentUserDto = SessionUser;

export type UpdateProfilePayload = {
    email: string;
    fullName: string;
};

export type ChangePasswordPayload = {
    oldPassword: string;
    newPassword: string;
};

type MeResponse = {
    id: number;
    username: string;
    email: string;
    role: string;
    fullName?: string | null;
};

export async function fetchCurrentUser(): Promise<CurrentUserDto> {
    const data = await apiFetch<MeResponse>('/api/auth/me');
    const user: SessionUser = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        fullName: data.fullName,
    };
    setSessionUser(user);
    return user;
}

export async function updateCurrentUser(
    payload: UpdateProfilePayload,
): Promise<CurrentUserDto> {
    const user = getSessionUser();
    if (!user) {
        throw new Error('Не авторизован');
    }

    const email = payload.email.trim();
    const fullName = payload.fullName.trim();

    if (!email) {
        throw new Error('Введите email');
    }

    // const updatedUser: SessionUser = {
    //     ...user,
    //     email,
    //     fullName: fullName || null,
    // };

    // setSessionUser(updatedUser);
    // return updatedUser;
    await apiFetch<void>('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
            email: payload.email.trim(),
            fullName: payload.fullName.trim(),
        }),
    });
    return fetchCurrentUser();
}

export async function changeCurrentUserPassword(
    payload: ChangePasswordPayload,
): Promise<string> {
    if (!getSessionUser()) {
        throw new Error('Не авторизован');
    }

    if (!payload.oldPassword) {
        throw new Error('Введите текущий пароль');
    }

    if (!payload.newPassword || payload.newPassword.length < 6) {
        throw new Error('Новый пароль должен содержать минимум 6 символов');
    }

    await apiFetch<void>('/api/auth/me/password', {
        method: 'PUT',
        body: JSON.stringify({
            oldPassword: payload.oldPassword,
            newPassword: payload.newPassword,
        }),
    });

    return 'Пароль изменен';
}

export async function deactivateCurrentUser(): Promise<string> {
    if (!getSessionUser()) {
        throw new Error('Не авторизован');
    }

    await apiFetch<void>('/api/auth/me', { method: 'DELETE' });
    clearSession();

    clearSession();
    return 'Аккаунт удален';
}

export async function logoutUser(): Promise<void> {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' });
    clearSession();
}
