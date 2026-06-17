'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useQueryClient } from '@tanstack/react-query';

import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { TextField } from '@/shared/ui/TextField';
import { Typography } from '@/shared/ui/Typography';

import styles from './DiagramSettingsSection.module.scss';

import { deleteDiagram, updateDiagramName } from '../api/diagrams';

type DiagramSettingsSectionProps = {
    diagramId: number;
    diagramName: string;
    canRename: boolean;
    canDelete: boolean;
};

function DiagramSettingsForm(props: DiagramSettingsSectionProps) {
    const { diagramId, diagramName, canRename, canDelete } = props;
    const { t } = useLocale();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [name, setName] = useState(diagramName);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    if (!canRename && !canDelete) {
        return null;
    }

    const invalidate = async () => {
        await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
        await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
    };

    const handleSave = async () => {
        if (!canRename) {
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await updateDiagramName(diagramId, name);
            await invalidate();
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : t.diagrams.updateError,
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        setConfirmOpen(false);
        setIsDeleting(true);
        setError(null);
        try {
            await deleteDiagram(diagramId);
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
            router.replace('/diagrams');
        } catch (deleteError) {
            setError(
                deleteError instanceof Error
                    ? deleteError.message
                    : t.diagrams.deleteError,
            );
            setIsDeleting(false);
        }
    };

    return (
        <section className={styles.Card}>
            <ConfirmModal
                open={confirmOpen}
                message={t.diagrams.deleteConfirm(diagramName)}
                dangerous
                onConfirm={() => void handleDeleteConfirm()}
                onCancel={() => setConfirmOpen(false)}
            />
            <Typography variant="subtitle1">{t.diagrams.settingsTitle}</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <div className={styles.SettingsRow}>
                <TextField
                    label={t.diagrams.nameLabel}
                    value={name}
                    onChange={setName}
                    disabled={!canRename || isSaving || isDeleting}
                />
                <div className={styles.Actions}>
                    {canRename ? (
                        <Button
                            variant="contained"
                            loading={isSaving}
                            disabled={isDeleting || name.trim() === diagramName}
                            onClick={() => void handleSave()}
                        >
                            {t.diagrams.saveSettings}
                        </Button>
                    ) : null}
                    {canDelete ? (
                        <Button
                            variant="outlined"
                            color="error"
                            loading={isDeleting}
                            disabled={isSaving}
                            onClick={() => setConfirmOpen(true)}
                        >
                            {t.diagrams.deleteDiagram}
                        </Button>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

export function DiagramSettingsSection(props: DiagramSettingsSectionProps) {
    return <DiagramSettingsForm key={props.diagramName} {...props} />;
}
