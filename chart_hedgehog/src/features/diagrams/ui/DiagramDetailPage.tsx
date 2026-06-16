'use client';

import { useParams } from 'next/navigation';

import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Typography } from '@/shared/ui/Typography';

import { useDiagramDetailContext } from '../model/useDiagramDetailContext';
import { DiagramCanvasPlaceholder } from './DiagramCanvasPlaceholder';
import { DiagramDetailLayout } from './DiagramDetailLayout';

export function DiagramDetailPage() {
    const { t } = useLocale();
    const params = useParams();
    const diagramId = Number(params?.id);

    const { diagram, isLoading, loadError } =
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

    const canEdit =
        diagram.currentUserRole === 'OWNER' || diagram.currentUserRole === 'EDITOR';

    return (
        <DiagramDetailLayout
            diagramId={diagramId}
            diagramName={diagram.name}
            currentUserRole={diagram.currentUserRole}
        >
            <DiagramCanvasPlaceholder diagramId={diagramId} canEdit={canEdit} />
        </DiagramDetailLayout>
    );
}
