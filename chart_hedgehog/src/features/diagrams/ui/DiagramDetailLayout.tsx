'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { PropsWithChildren } from 'react';

import { AppNavbar } from '@/widgets/AppNavbar';
import { useLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Typography } from '@/shared/ui/Typography';

import styles from './DiagramDetailLayout.module.scss';

import { roleLabel } from '../constants/roles';
import { DiagramSettingsSection } from './DiagramSettingsSection';

type DiagramDetailLayoutProps = PropsWithChildren<{
    diagramId: number;
    diagramName: string;
    currentUserRole: string;
}>;

export function DiagramDetailLayout(props: DiagramDetailLayoutProps) {
    const { diagramId, diagramName, currentUserRole, children } = props;
    const { t } = useLocale();
    const pathname = usePathname();

    const basePath = `/diagrams/${diagramId}`;
    const isParticipants = pathname?.endsWith('/participants') ?? false;
    const canRename =
        currentUserRole === 'OWNER' || currentUserRole === 'EDITOR';
    const canDelete = currentUserRole === 'OWNER';

    return (
        <>
            <AppNavbar />
            <main className={styles.Page}>
                <div className={styles.HeaderRow}>
                    <div>
                        <Typography variant="h4" component="h1">
                            {diagramName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t.diagrams.yourRole}:{' '}
                            {roleLabel(currentUserRole, t.roles)}
                        </Typography>
                    </div>
                    <Button
                        component={Link}
                        href="/diagrams"
                        variant="outlined"
                        size="small"
                    >
                        {t.common.backToList}
                    </Button>
                </div>

                <nav className={styles.PageNav} aria-label={t.diagrams.sectionsLabel}>
                    <Button
                        component={Link}
                        href={basePath}
                        variant={isParticipants ? 'outlined' : 'contained'}
                        size="small"
                        disabled={!isParticipants}
                    >
                        {t.common.diagram}
                    </Button>
                    <Button
                        component={Link}
                        href={`${basePath}/participants`}
                        variant={isParticipants ? 'contained' : 'outlined'}
                        size="small"
                        disabled={isParticipants}
                    >
                        {t.common.participants}
                    </Button>
                </nav>

                <DiagramSettingsSection
                    diagramId={diagramId}
                    diagramName={diagramName}
                    canRename={canRename}
                    canDelete={canDelete}
                />

                {children}
            </main>
        </>
    );
}
