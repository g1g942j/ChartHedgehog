'use client';

import { useMemo, useRef, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';

import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { Typography } from '@/shared/ui/Typography';

import styles from './DiagramCanvasPlaceholder.module.scss';

import {
    DIAGRAM_TEMPLATES,
    type DiagramBlockTemplate,
    type DiagramCanvasBlock,
    type DiagramEditorState,
    fetchDiagramEditorState,
    saveDiagramEditorState,
    UML_BLOCK_TEMPLATES,
} from '../api/diagramEditor';

type DiagramCanvasPlaceholderProps = {
    diagramId: number;
    canEdit: boolean;
};

type DiagramEditorFormProps = DiagramCanvasPlaceholderProps & {
    initialState: DiagramEditorState;
};

function DiagramEditorForm(props: DiagramEditorFormProps) {
    const { diagramId, canEdit, initialState } = props;
    const { t } = useLocale();
    const queryClient = useQueryClient();
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const [template, setTemplate] = useState<string>(
        initialState.template ?? 'uml',
    );
    const [blocks, setBlocks] = useState<DiagramCanvasBlock[]>(
        initialState.blocks,
    );
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const templateOptions = useMemo<SelectOption[]>(
        () =>
            DIAGRAM_TEMPLATES.map((item) => ({
                value: item.id,
                label: item.name,
            })),
        [],
    );

    const createBlock = (
        blockTemplate: DiagramBlockTemplate,
        id: string,
        x = 80,
        y = 80,
    ): DiagramCanvasBlock => ({
        id,
        type: blockTemplate.type,
        title: blockTemplate.title,
        body: blockTemplate.body,
        x,
        y,
        width: blockTemplate.width,
        height: blockTemplate.height,
    });

    const updateBlock = (
        blockId: string,
        patch: Partial<DiagramCanvasBlock>,
    ) => {
        setBlocks((currentBlocks) =>
            currentBlocks.map((block) =>
                block.id === blockId ? { ...block, ...patch } : block,
            ),
        );
    };

    const handleApplyTemplate = () => {
        const nextTemplate = DIAGRAM_TEMPLATES.find((item) => item.id === template);
        if (nextTemplate) {
            setBlocks(nextTemplate.blocks);
        }
    };

    const handleAddBlock = (blockTemplate: DiagramBlockTemplate) => {
        setBlocks((currentBlocks) => [
            ...currentBlocks,
            createBlock(
                blockTemplate,
                `${blockTemplate.type}-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
                80 + currentBlocks.length * 24,
                80,
            ),
        ]);
    };

    const handlePaletteDragStart = (
        event: DragEvent<HTMLButtonElement>,
        type: string,
    ) => {
        event.dataTransfer.setData('application/chart-hedgehog-block', type);
    };

    const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!canEdit) {
            return;
        }

        const blockType = event.dataTransfer.getData(
            'application/chart-hedgehog-block',
        );
        const blockTemplate = UML_BLOCK_TEMPLATES.find(
            (item) => item.type === blockType,
        );
        const rect = canvasRef.current?.getBoundingClientRect();

        if (!blockTemplate || !rect) {
            return;
        }

        setBlocks((currentBlocks) => [
            ...currentBlocks,
            createBlock(
                blockTemplate,
                `${blockTemplate.type}-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
                Math.max(0, event.clientX - rect.left - 40),
                Math.max(0, event.clientY - rect.top - 24),
            ),
        ]);
    };

    const handleBlockDrag = (
        event: ReactPointerEvent<HTMLDivElement>,
        block: DiagramCanvasBlock,
    ) => {
        if (!canEdit) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        const startX = event.clientX;
        const startY = event.clientY;
        const startBlockX = block.x;
        const startBlockY = block.y;

        const handleMove = (moveEvent: PointerEvent) => {
            updateBlock(block.id, {
                x: Math.max(0, startBlockX + moveEvent.clientX - startX),
                y: Math.max(0, startBlockY + moveEvent.clientY - startY),
            });
        };

        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    const handleBlockResize = (
        event: ReactPointerEvent<HTMLButtonElement>,
        block: DiagramCanvasBlock,
    ) => {
        if (!canEdit) {
            return;
        }

        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = block.width;
        const startHeight = block.height;

        const handleMove = (moveEvent: PointerEvent) => {
            updateBlock(block.id, {
                width: Math.max(120, startWidth + moveEvent.clientX - startX),
                height: Math.max(80, startHeight + moveEvent.clientY - startY),
            });
        };

        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await saveDiagramEditorState(diagramId, {
                template,
                blocks,
            });
            await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
            await queryClient.invalidateQueries({
                queryKey: ['diagramEditor', diagramId],
            });
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : t.diagrams.saveContentError,
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className={styles.Placeholder}>
            <Typography variant="subtitle1">{t.diagrams.canvasTitle}</Typography>
            <Typography variant="body2" color="text.secondary">
                {t.diagrams.canvasDescription}
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <div className={styles.Toolbar}>
                <div className={styles.TemplateRow}>
                    <Select
                        label={t.diagrams.templateLabel}
                        value={template}
                        onChange={setTemplate}
                        options={templateOptions}
                        disabled={!canEdit || isSaving}
                    />
                    <Button
                        variant="outlined"
                        disabled={!canEdit || isSaving}
                        onClick={handleApplyTemplate}
                    >
                        {t.diagrams.applyTemplate}
                    </Button>
                </div>
                <Button
                    variant="contained"
                    loading={isSaving}
                    disabled={!canEdit}
                    onClick={() => void handleSave()}
                >
                    {t.diagrams.saveContent}
                </Button>
            </div>
            <div className={styles.EditorShell}>
                <aside className={styles.Palette}>
                    <Typography variant="subtitle2">{t.diagrams.umlBlocks}</Typography>
                    {UML_BLOCK_TEMPLATES.map((blockTemplate) => (
                        <button
                            key={blockTemplate.type}
                            type="button"
                            className={styles.PaletteItem}
                            draggable={canEdit}
                            disabled={!canEdit}
                            onClick={() => handleAddBlock(blockTemplate)}
                            onDragStart={(event) =>
                                handlePaletteDragStart(event, blockTemplate.type)
                            }
                        >
                            {blockTemplate.name}
                        </button>
                    ))}
                </aside>
                <div
                    ref={canvasRef}
                    className={styles.Canvas}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleCanvasDrop}
                >
                    {blocks.length === 0 ? (
                        <Typography
                            className={styles.CanvasHint}
                            variant="body2"
                            color="text.secondary"
                        >
                            {t.diagrams.canvasHint}
                        </Typography>
                    ) : null}
                    {blocks.map((block) => (
                        <div
                            key={block.id}
                            className={`${styles.Block} ${styles[`Block_${block.type}`]}`}
                            style={{
                                left: block.x,
                                top: block.y,
                                width: block.width,
                                height: block.height,
                            }}
                        >
                            <div
                                className={styles.BlockHeader}
                                onPointerDown={(event) =>
                                    handleBlockDrag(event, block)
                                }
                            >
                                {block.title}
                            </div>
                            <pre className={styles.BlockBody}>{block.body}</pre>
                            {canEdit ? (
                                <button
                                    type="button"
                                    aria-label="Resize block"
                                    className={styles.ResizeHandle}
                                    onPointerDown={(event) =>
                                        handleBlockResize(event, block)
                                    }
                                />
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function DiagramCanvasPlaceholder(props: DiagramCanvasPlaceholderProps) {
    const { diagramId } = props;
    const { t } = useLocale();
    const editorQuery = useQuery({
        queryKey: ['diagramEditor', diagramId],
        queryFn: () => fetchDiagramEditorState(diagramId),
    });

    if (editorQuery.isPending) {
        return <Typography color="text.secondary">{t.common.loading}</Typography>;
    }

    if (editorQuery.error || !editorQuery.data) {
        return (
            <Alert severity="error">
                {editorQuery.error instanceof Error
                    ? editorQuery.error.message
                    : t.diagrams.saveContentError}
            </Alert>
        );
    }

    return (
        <DiagramEditorForm
            key={`${diagramId}:${editorQuery.data.template ?? ''}:${editorQuery.data.blocks.length}`}
            {...props}
            initialState={editorQuery.data}
        />
    );
}
