'use client';

import { useController, useFormContext } from 'react-hook-form';

import { TextField, type TextFieldProps } from '@/shared/ui/TextField';

export type FormTextFieldProps = {
    name: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
} & Omit<TextFieldProps, 'value' | 'error' | 'errorMessage' | 'onChange' | 'name'>;

export function FormTextField(props: FormTextFieldProps) {
    const { name, defaultValue = '', onChange, ...restProps } = props;

    const { control } = useFormContext();
    const { field, fieldState } = useController({
        name,
        control,
        defaultValue,
    });

    const handleChange = (value: string) => {
        field.onChange(value);
        onChange?.(value);
    };

    return (
        <TextField
            {...restProps}
            name={name}
            value={field.value}
            error={Boolean(fieldState.error)}
            errorMessage={fieldState.error?.message?.toString()}
            onChange={handleChange}
        />
    );
}
