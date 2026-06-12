import { z } from 'zod';

import type { AppTranslations } from '@/shared/i18n';

export function createLoginSchema(t: AppTranslations['auth']['validation']) {
    return z.object({
        email: z.email(t.emailInvalid),
        password: z
            .string()
            .min(6, t.passwordMin)
            .max(100, t.passwordMax),
    });
}

export const loginSchema = createLoginSchema({
    usernameMin: 'Имя пользователя: минимум 3 символа',
    usernameMax: 'Имя пользователя: максимум 50 символов',
    emailInvalid: 'Некорректный email',
    passwordMin: 'Пароль: минимум 6 символов',
    passwordMax: 'Пароль: максимум 100 символов',
    confirmPasswordRequired: 'Подтвердите пароль',
    passwordsMismatch: 'Пароли не совпадают',
});

export type LoginFormValues = z.infer<typeof loginSchema>;
