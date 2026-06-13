import {
    clearSession,
    getSessionUser,
    setSessionUser,
    type SessionUser,
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
    const user = getSessionUser();
    if (!user) {
        throw new Error('Не авторизован');
    }
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

    const updatedUser: SessionUser = {
        ...user,
        email,
        fullName: fullName || null,
    };

    setSessionUser(updatedUser);
    return updatedUser;
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

    return 'Пароль изменен';
}

export async function deactivateCurrentUser(): Promise<string> {
    if (!getSessionUser()) {
        throw new Error('Не авторизован');
    }

    clearSession();
    return 'Аккаунт удален';
}

export async function logoutUser(): Promise<void> {
    clearSession();
}
