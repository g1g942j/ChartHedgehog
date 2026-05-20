import type { TypographyProps as MuiTypographyProps } from '@mui/material/Typography';
import MuiTypography from '@mui/material/Typography';

import styles from './Typography.module.scss';

export type TypographyProps = MuiTypographyProps;

export function Typography(props: TypographyProps) {
    const { className, ...rest } = props;
    return (
        <MuiTypography
            {...rest}
            className={`${styles.Typography} ${className || ''}`}
        />
    );
}
