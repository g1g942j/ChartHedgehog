'use client';

import { useParams } from 'next/navigation';

import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Typography } from '@/shared/ui/Typography';

import { useDiagramDetailContext } from '../model/useDiagramDetailContext';
import { DiagramEditorLoader } from './DiagramEditorPage';

export function DiagramDetailPage() {
    const { t } = useLocale();
    const params = useParams();
    const diagramId = Number(params?.id);

    const { diagram, isLoading, loadError } = useDiagramDetailContext(diagramId);

    if (Number.isNaN(diagramId)) {
        return (
            <main style={{ padding: 32 }}>
                <Alert severity="error">{t.diagrams.invalidId}</Alert>
            </main>
        );
    }

    if (isLoading) {
        return (
            <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <Typography color="text.secondary">{t.common.loading}</Typography>
            </main>
        );
    }

    if (loadError || !diagram) {
        return (
            <main style={{ padding: 32 }}>
                <Alert severity="error">{loadError ?? t.diagrams.notFound}</Alert>
            </main>
        );
    }

    return (
        <DiagramEditorLoader
            diagramId={diagramId}
            diagramName={diagram.name}
            currentUserRole={diagram.currentUserRole}
        />
    );
}
