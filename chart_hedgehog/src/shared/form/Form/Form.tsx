'use client';

import type { PropsWithChildren } from 'react';
import {
    type FieldValues,
    FormProvider,
    type SubmitHandler,
    type UseFormReturn,
} from 'react-hook-form';

export type FormProps<T extends FieldValues> = PropsWithChildren<{
    methods: UseFormReturn<T>;
    onSubmit: SubmitHandler<T>;
    className?: string;
}>;

export function Form<T extends FieldValues>(props: FormProps<T>) {
    const { methods, onSubmit, children, className } = props;
    const { handleSubmit } = methods;

    return (
        <FormProvider {...methods}>
            <form className={className} onSubmit={handleSubmit(onSubmit)}>
                {children}
            </form>
        </FormProvider>
    );
}
