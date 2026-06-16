import type { CSSProperties } from 'react';

import styles from './Skeleton.module.scss';

type SkeletonProps = {
    width?: CSSProperties['width'];
    height?: CSSProperties['height'];
    borderRadius?: CSSProperties['borderRadius'];
    className?: string;
};

export function Skeleton({ width, height, borderRadius, className = '' }: SkeletonProps) {
    return (
        <span
            className={`${styles.Skeleton} ${className}`}
            style={{ width, height, borderRadius }}
        />
    );
}
