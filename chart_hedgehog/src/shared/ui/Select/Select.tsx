'use client';

import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect, { type SelectChangeEvent } from '@mui/material/Select';

import styles from './Select.module.scss';

export type SelectOption<T extends string | number = string> = {
    value: T;
    label: string;
    disabled?: boolean;
};

export type SelectProps<T extends string | number = string> = {
    name?: string;
    label?: string;
    value?: T;
    onChange?: (value: T) => void;
    options: SelectOption<T>[];
    error?: boolean;
    errorMessage?: string;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
};

export function Select<T extends string | number = string>(props: SelectProps<T>) {
    const {
        name,
        label,
        value,
        onChange,
        options,
        error = false,
        errorMessage,
        disabled,
        className,
        placeholder,
    } = props;

    const labelId = name ? `${name}-label` : undefined;
    const selectValue = value ?? ('' as T);

    const handleChange = (event: SelectChangeEvent<T>) => {
        onChange?.(event.target.value as T);
    };

    return (
        <FormControl
            fullWidth
            error={error}
            disabled={disabled}
            className={`${styles.Select} ${className ?? ''}`.trim()}
        >
            {label ? <InputLabel id={labelId}>{label}</InputLabel> : null}
            <MuiSelect<T>
                name={name}
                labelId={labelId}
                label={label}
                value={selectValue}
                onChange={handleChange}
                displayEmpty={Boolean(placeholder)}
            >
                {placeholder ? (
                    <MenuItem value="" disabled>
                        {placeholder}
                    </MenuItem>
                ) : null}
                {options.map((option) => (
                    <MenuItem
                        key={String(option.value)}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </MenuItem>
                ))}
            </MuiSelect>
            {error && errorMessage ? (
                <FormHelperText>{errorMessage}</FormHelperText>
            ) : null}
        </FormControl>
    );
}
