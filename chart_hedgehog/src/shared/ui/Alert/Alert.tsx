import type { AlertProps as MuiAlertProps } from '@mui/material/Alert';
import MuiAlert from '@mui/material/Alert';

import styles from './Alert.module.scss';

export type AlertProps = MuiAlertProps;

export function Alert(props: AlertProps) {
    const { className, variant = 'filled', ...rest } = props;
    return (
        <MuiAlert
            {...rest}
            variant={variant}
            className={`${styles.Alert} ${className || ''}`}
        />
    );
}
