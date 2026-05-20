'use client';

import type { TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField';
import MuiTextField from '@mui/material/TextField';

import styles from './TextField.module.scss';

type NativeTextFieldProps = Omit<
    MuiTextFieldProps,
    'value' | 'defaultValue' | 'onChange' | 'error'
>;

export type TextFieldProps = NativeTextFieldProps & {
    label?: string;
    value?: string;
    error?: boolean;
    errorMessage?: string;
    onChange?: (value: string) => void;
};

export function TextField(props: TextFieldProps) {
    const {
        label,
        value = '',
        error = false,
        errorMessage,
        onChange,
        className,
        name,
        helperText: helperTextProp,
        ...rest
    } = props;

    return (
        <MuiTextField
            {...rest}
            name={name}
            label={label}
            value={value}
            error={error}
            helperText={error ? errorMessage : helperTextProp}
            onChange={(event) => onChange?.(event.target.value)}
            className={`${styles.TextField} ${className ?? ''}`.trim()}
            fullWidth
            variant="outlined"
        />
    );
}
