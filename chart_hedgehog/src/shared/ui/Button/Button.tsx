'use client';

import type { ButtonProps as MuiButtonProps } from '@mui/material/Button';
import MuiButton from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import styles from './Button.module.scss';

export type ButtonProps = MuiButtonProps & {
    loading?: boolean;
};

export function Button(props: ButtonProps) {
    const {
        className,
        loading = false,
        disabled,
        children,
        ...rest
    } = props;

    return (
        <MuiButton
            {...rest}
            disabled={disabled || loading}
            className={`${styles.Button} ${className ?? ''}`.trim()}
        >
            {loading ? (
                <CircularProgress
                    size={20}
                    color="inherit"
                    className={styles.Spinner}
                />
            ) : null}
            {children}
        </MuiButton>
    );
}
