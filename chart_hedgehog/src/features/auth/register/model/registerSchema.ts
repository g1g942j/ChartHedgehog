import { z } from 'zod';

export const registerSchema = z
    .object({
        username: z
            .string()
            .min(3, 'Имя пользователя: минимум 3 символа')
            .max(50, 'Имя пользователя: максимум 50 символов'),
        email: z.email('Некорректный email'),
        password: z
            .string()
            .min(6, 'Пароль: минимум 6 символов')
            .max(100, 'Пароль: максимум 100 символов'),
        confirmPassword: z.string().min(1, 'Подтвердите пароль'),
        fullName: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Пароли не совпадают',
        path: ['confirmPassword'],
    });

export type RegisterFormValues = z.infer<typeof registerSchema>;
