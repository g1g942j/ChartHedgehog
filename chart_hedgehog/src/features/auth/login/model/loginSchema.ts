import { z } from 'zod';

export const loginSchema = z.object({
    username: z
        .string()
        .min(3, 'Имя пользователя: минимум 3 символа')
        .max(50, 'Имя пользователя: максимум 50 символов'),
    password: z
        .string()
        .min(6, 'Пароль: минимум 6 символов')
        .max(100, 'Пароль: максимум 100 символов'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
