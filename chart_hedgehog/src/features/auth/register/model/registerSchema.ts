import { z } from 'zod';

import type { AppTranslations } from '@/shared/i18n';

export function createRegisterSchema(t: AppTranslations['auth']['validation']) {
    return z
        .object({
            username: z
                .string()
                .min(3, t.usernameMin)
                .max(50, t.usernameMax),
            email: z.email(t.emailInvalid),
            password: z
                .string()
                .min(6, t.passwordMin)
                .max(100, t.passwordMax),
            confirmPassword: z.string().min(1, t.confirmPasswordRequired),
            fullName: z.string().optional(),
        })
        .refine((data) => data.password === data.confirmPassword, {
            message: t.passwordsMismatch,
            path: ['confirmPassword'],
        });
}

export const registerSchema = createRegisterSchema({
    usernameMin: 'Имя пользователя: минимум 3 символа',
    usernameMax: 'Имя пользователя: максимум 50 символов',
    emailInvalid: 'Некорректный email',
    passwordMin: 'Пароль: минимум 6 символов',
    passwordMax: 'Пароль: максимум 100 символов',
    confirmPasswordRequired: 'Подтвердите пароль',
    passwordsMismatch: 'Пароли не совпадают',
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
