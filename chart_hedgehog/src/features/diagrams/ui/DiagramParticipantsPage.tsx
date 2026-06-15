'use client';

import { useParams } from 'next/navigation';

import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Typography } from '@/shared/ui/Typography';

import { canManageParticipants } from '../constants/roles';
import { useDiagramDetailContext } from '../model/useDiagramDetailContext';
import { DiagramDetailLayout } from './DiagramDetailLayout';
import { DiagramParticipantsSection } from './DiagramParticipantsSection';

export function DiagramParticipantsPage() {
    const { t } = useLocale();
    const params = useParams();
    const diagramId = Number(params?.id);

    const { diagram, currentUser, isLoading, loadError } =
        useDiagramDetailContext(diagramId);

    if (Number.isNaN(diagramId)) {
        return (
            <main>
                <Alert severity="error">{t.diagrams.invalidId}</Alert>
            </main>
        );
    }

    if (isLoading) {
        return (
            <main style={{ padding: 32 }}>
                <Typography>{t.common.loading}</Typography>
            </main>
        );
    }

    if (loadError || !diagram) {
        return (
            <main style={{ padding: 32 }}>
                <Alert severity="error">
                    {loadError ?? t.diagrams.notFound}
                </Alert>
            </main>
        );
    }

    const canManage = canManageParticipants(diagram.currentUserRole);
    const isOwner = diagram.currentUserRole === 'OWNER';

    return (
        <DiagramDetailLayout
            diagramId={diagramId}
            diagramName={diagram.name}
            currentUserRole={diagram.currentUserRole}
        >
            <DiagramParticipantsSection
                diagramId={diagramId}
                canManage={canManage}
                currentUsername={currentUser?.username}
                isOwner={isOwner}
            />
        </DiagramDetailLayout>
    );
}
