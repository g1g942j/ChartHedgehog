'use client';

import { useController, useFormContext } from 'react-hook-form';

import { Select, type SelectProps } from '@/shared/ui/Select';

export type FormSelectProps<T extends string | number = string> = {
    name: string;
    defaultValue?: T;
    onChange?: (value: T) => void;
} & Omit<SelectProps<T>, 'value' | 'error' | 'errorMessage' | 'onChange' | 'name'>;

export function FormSelect<T extends string | number = string>(
    props: FormSelectProps<T>,
) {
    const { name, defaultValue = '' as T, onChange, ...restProps } = props;

    const { control } = useFormContext();
    const { field, fieldState } = useController({
        name,
        control,
        defaultValue,
    });

    const handleChange = (value: T) => {
        field.onChange(value);
        onChange?.(value);
    };

    return (
        <Select
            {...restProps}
            name={name}
            value={field.value}
            error={Boolean(fieldState.error)}
            errorMessage={fieldState.error?.message?.toString()}
            onChange={handleChange}
        />
    );
}
