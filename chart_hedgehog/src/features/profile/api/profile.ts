import { API_BASE_URL, ApiError, apiFetch } from '@/shared/api/client';
import {
    clearSession,
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

export async function fetchCurrentUser(): Promise<CurrentUserDto> {
    try {
        return await apiFetch<CurrentUserDto>('/api/auth/me');
    } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
            throw new Error('Не авторизован');
        }
        throw err;
    }
}

export async function updateCurrentUser(
    payload: UpdateProfilePayload,
): Promise<CurrentUserDto> {
    const email = payload.email.trim();
    const fullName = payload.fullName.trim();
    if (!email) throw new Error('Введите email');

    const result = await apiFetch<CurrentUserDto>('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ fullName: fullName || null, email }),
    });
    setSessionUser(result);
    return result;
}

export async function changeCurrentUserPassword(
    payload: ChangePasswordPayload,
): Promise<string> {
    if (!payload.oldPassword) throw new Error('Введите текущий пароль');
    if (!payload.newPassword || payload.newPassword.length < 6) {
        throw new Error('Новый пароль должен содержать минимум 6 символов');
    }
    const result = await apiFetch<{ message: string }>('/api/auth/me/password', {
        method: 'PUT',
        body: JSON.stringify({
            oldPassword: payload.oldPassword,
            newPassword: payload.newPassword,
        }),
    });
    return result.message;
}

export async function deactivateCurrentUser(): Promise<string> {
    const result = await apiFetch<{ message: string }>('/api/auth/me', {
        method: 'DELETE',
    });
    clearSession();
    document.cookie = 'ch_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    return result.message;
}

export async function logoutUser(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch {
        // ignore network errors — clear client state regardless
    }
    clearSession();
    document.cookie = 'ch_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}
