'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import GestureOutlinedIcon from '@mui/icons-material/GestureOutlined';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';

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
    type DiagramElement,
    type DiagramLineElement,
    type DiagramPencilElement,
    fetchDiagramEditorState,
    isShapeBlockType,
    type LineEnding,
    type LineStyle,
    saveDiagramEditorState,
    SHAPE_BLOCK_TEMPLATES,
    UML_BLOCK_TEMPLATES,
} from '../api/diagramEditor';

type DrawingTool = 'select' | 'line' | 'pencil' | 'eraser';
type EditingBlock = { id: string; title: string; body: string };

type DiagramCanvasPlaceholderProps = {
    diagramId: number;
    canEdit: boolean;
};

type DiagramEditorFormProps = DiagramCanvasPlaceholderProps & {
    initialState: DiagramEditorState;
};

function isBlock(el: DiagramElement): el is DiagramCanvasBlock {
    return !('kind' in el) || (el as { kind?: string }).kind === undefined;
}

function isLine(el: DiagramElement): el is DiagramLineElement {
    return 'kind' in el && (el as DiagramLineElement).kind === 'line';
}

function isPencil(el: DiagramElement): el is DiagramPencilElement {
    return 'kind' in el && (el as DiagramPencilElement).kind === 'pencil';
}

function pointsToPath(points: [number, number][]): string {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')}`;
}

function dashArray(style: LineStyle): string | undefined {
    if (style === 'dashed') return '10,5';
    if (style === 'dotted') return '3,5';
    return undefined;
}

const LINE_STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
    { value: 'solid', label: 'Сплошная' },
    { value: 'dashed', label: 'Штриховая' },
    { value: 'dotted', label: 'Пунктир' },
];

const ENDING_OPTIONS: { value: LineEnding; label: string }[] = [
    { value: 'none', label: 'Нет' },
    { value: 'arrow', label: 'Стрелка' },
    { value: 'open-arrow', label: 'Открытая' },
    { value: 'circle-end', label: 'Круг' },
];

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

function SvgDefs() {
    return (
        <defs>
            <marker id="ch-arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-color)" />
            </marker>
            <marker id="ch-open-arrow-end" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <polyline points="0,1 9,4 0,7" fill="none" stroke="var(--text-color)" strokeWidth="1.5" />
            </marker>
            <marker id="ch-circle-end" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <circle cx="4" cy="4" r="3" fill="var(--text-color)" />
            </marker>
            <marker id="ch-arrow-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-color)" />
            </marker>
            <marker id="ch-open-arrow-start" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse">
                <polyline points="0,1 9,4 0,7" fill="none" stroke="var(--text-color)" strokeWidth="1.5" />
            </marker>
            <marker id="ch-circle-start" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
                <circle cx="4" cy="4" r="3" fill="var(--text-color)" />
            </marker>
        </defs>
    );
}

function markerEnd(ending: LineEnding): string | undefined {
    if (ending === 'arrow') return 'url(#ch-arrow-end)';
    if (ending === 'open-arrow') return 'url(#ch-open-arrow-end)';
    if (ending === 'circle-end') return 'url(#ch-circle-end)';
    return undefined;
}

function markerStart(ending: LineEnding): string | undefined {
    if (ending === 'arrow') return 'url(#ch-arrow-start)';
    if (ending === 'open-arrow') return 'url(#ch-open-arrow-start)';
    if (ending === 'circle-end') return 'url(#ch-circle-start)';
    return undefined;
}

function DiagramEditorForm(props: DiagramEditorFormProps) {
    const { diagramId, canEdit, initialState } = props;
    const { t } = useLocale();
    const queryClient = useQueryClient();
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const [template, setTemplate] = useState<string>(initialState.template ?? 'uml');
    const [elements, setElements] = useState<DiagramElement[]>(initialState.blocks);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tool, setTool] = useState<DrawingTool>('select');
    const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
    const [lineStartEnding, setLineStartEnding] = useState<LineEnding>('none');
    const [lineEndEnding, setLineEndEnding] = useState<LineEnding>('arrow');
    const [activeLineStart, setActiveLineStart] = useState<{ x: number; y: number } | null>(null);
    const [activeLineCurrent, setActiveLineCurrent] = useState<{ x: number; y: number } | null>(null);
    const activePencilRef = useRef<{ id: string; points: [number, number][] } | null>(null);
    const [pencilPreview, setPencilPreview] = useState<[number, number][]>([]);
    const [zoom, setZoom] = useState(1);
    const [editing, setEditing] = useState<EditingBlock | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handleWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom((z) =>
                parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)).toFixed(1)),
            );
        };
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, []);

    const templateOptions = useMemo<SelectOption[]>(
        () => DIAGRAM_TEMPLATES.map((item) => ({ value: item.id, label: item.name })),
        [],
    );
    const lineStyleOptions = useMemo<SelectOption[]>(
        () => LINE_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
        [],
    );
    const endingOptions = useMemo<SelectOption[]>(
        () => ENDING_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
        [],
    );

    const getCanvasPoint = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left + canvas.scrollLeft) / zoom,
            y: (clientY - rect.top + canvas.scrollTop) / zoom,
        };
    };

    const clampZoom = (next: number) =>
        setZoom(parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)).toFixed(1)));

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

    const updateElement = (id: string, patch: Partial<DiagramCanvasBlock>) => {
        setElements((current) =>
            current.map((el) => (isBlock(el) && el.id === id ? { ...el, ...patch } : el)),
        );
    };

    const removeElement = (id: string) => {
        setElements((current) => current.filter((el) => el.id !== id));
    };

    const startEditing = (block: DiagramCanvasBlock) => {
        if (!canEdit || tool !== 'select') return;
        setEditing({ id: block.id, title: block.title, body: block.body });
    };

    const commitEdit = () => {
        if (!editing) return;
        updateElement(editing.id, { title: editing.title, body: editing.body });
        setEditing(null);
    };

    const handleApplyTemplate = () => {
        const nextTemplate = DIAGRAM_TEMPLATES.find((item) => item.id === template);
        if (nextTemplate) setElements(nextTemplate.blocks);
    };

    const handleAddBlock = (blockTemplate: DiagramBlockTemplate) => {
        setElements((current) => [
            ...current,
            createBlock(
                blockTemplate,
                `${blockTemplate.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                80 + current.filter(isBlock).length * 24,
                80,
            ),
        ]);
    };

    const handlePaletteDragStart = (event: DragEvent<HTMLButtonElement>, type: string) => {
        event.dataTransfer.setData('application/chart-hedgehog-block', type);
    };

    const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!canEdit) return;
        const blockType = event.dataTransfer.getData('application/chart-hedgehog-block');
        const blockTemplate = [...UML_BLOCK_TEMPLATES, ...SHAPE_BLOCK_TEMPLATES].find(
            (item) => item.type === blockType,
        );
        if (!blockTemplate) return;
        const pt = getCanvasPoint(event.clientX, event.clientY);
        setElements((current) => [
            ...current,
            createBlock(
                blockTemplate,
                `${blockTemplate.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                Math.max(0, pt.x - 40),
                Math.max(0, pt.y - 24),
            ),
        ]);
    };

    const handleBlockPointerDown = (
        event: ReactPointerEvent<HTMLDivElement>,
        block: DiagramCanvasBlock,
    ) => {
        if (!canEdit) return;
        if (editing?.id === block.id) return;

        if (tool === 'eraser') {
            removeElement(block.id);
            return;
        }
        if (tool !== 'select') return;

        event.currentTarget.setPointerCapture(event.pointerId);
        const startClientX = event.clientX;
        const startClientY = event.clientY;
        const startBlockX = block.x;
        const startBlockY = block.y;
        let moved = false;

        const handleMove = (moveEvent: PointerEvent) => {
            moved = true;
            updateElement(block.id, {
                x: Math.max(0, startBlockX + (moveEvent.clientX - startClientX) / zoom),
                y: Math.max(0, startBlockY + (moveEvent.clientY - startClientY) / zoom),
            });
        };

        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            if (!moved) {
                // single click without drag — do nothing special
            }
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    const handleBlockResize = (
        event: ReactPointerEvent<HTMLButtonElement>,
        block: DiagramCanvasBlock,
    ) => {
        if (!canEdit || tool !== 'select') return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = block.width;
        const startHeight = block.height;

        const handleMove = (moveEvent: PointerEvent) => {
            updateElement(block.id, {
                width: Math.max(80, startWidth + (moveEvent.clientX - startX) / zoom),
                height: Math.max(60, startHeight + (moveEvent.clientY - startY) / zoom),
            });
        };

        const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    const handleSvgPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!canEdit) return;
        const pt = getCanvasPoint(event.clientX, event.clientY);

        if (tool === 'line') {
            setActiveLineStart(pt);
            setActiveLineCurrent(pt);
        } else if (tool === 'pencil') {
            const id = `pencil-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            activePencilRef.current = { id, points: [[pt.x, pt.y]] };
            setPencilPreview([[pt.x, pt.y]]);
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    };

    const handleSvgPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!canEdit) return;
        const pt = getCanvasPoint(event.clientX, event.clientY);

        if (tool === 'line' && activeLineStart) {
            setActiveLineCurrent(pt);
        } else if (tool === 'pencil' && activePencilRef.current) {
            activePencilRef.current.points.push([pt.x, pt.y]);
            setPencilPreview([...activePencilRef.current.points]);
        }
    };

    const handleSvgPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!canEdit) return;
        const pt = getCanvasPoint(event.clientX, event.clientY);

        if (tool === 'line' && activeLineStart) {
            if (Math.hypot(pt.x - activeLineStart.x, pt.y - activeLineStart.y) > 8) {
                const line: DiagramLineElement = {
                    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    kind: 'line',
                    x1: activeLineStart.x,
                    y1: activeLineStart.y,
                    x2: pt.x,
                    y2: pt.y,
                    style: lineStyle,
                    startEnding: lineStartEnding,
                    endEnding: lineEndEnding,
                };
                setElements((current) => [...current, line]);
            }
            setActiveLineStart(null);
            setActiveLineCurrent(null);
        } else if (tool === 'pencil' && activePencilRef.current) {
            const { id, points } = activePencilRef.current;
            if (points.length > 2) {
                const pencil: DiagramPencilElement = { id, kind: 'pencil', points };
                setElements((current) => [...current, pencil]);
            }
            activePencilRef.current = null;
            setPencilPreview([]);
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await saveDiagramEditorState(diagramId, { template, blocks: elements });
            await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
            await queryClient.invalidateQueries({ queryKey: ['diagramEditor', diagramId] });
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : t.diagrams.saveContentError);
        } finally {
            setIsSaving(false);
        }
    };

    const isDrawing = tool === 'line' || tool === 'pencil';

    return (
        <section className={styles.Placeholder}>
            <Typography variant="subtitle1">{t.diagrams.canvasTitle}</Typography>
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
                    <Button variant="outlined" disabled={!canEdit || isSaving} onClick={handleApplyTemplate}>
                        {t.diagrams.applyTemplate}
                    </Button>
                </div>
                <Button variant="contained" loading={isSaving} disabled={!canEdit} onClick={() => void handleSave()}>
                    {t.diagrams.saveContent}
                </Button>
            </div>

            <div className={styles.ControlsBar}>
                {canEdit ? (
                    <div className={styles.ToolsRow}>
                        <button
                            type="button"
                            title="Выбор / редактирование (двойной клик)"
                            className={`${styles.ToolBtn} ${tool === 'select' ? styles.ToolBtn_active : ''}`}
                            onClick={() => setTool('select')}
                        >
                            <NearMeOutlinedIcon fontSize="small" />
                            <span>Выбор</span>
                        </button>
                        <button
                            type="button"
                            title="Линия"
                            className={`${styles.ToolBtn} ${tool === 'line' ? styles.ToolBtn_active : ''}`}
                            onClick={() => setTool('line')}
                        >
                            <TimelineOutlinedIcon fontSize="small" />
                            <span>Линия</span>
                        </button>
                        <button
                            type="button"
                            title="Карандаш"
                            className={`${styles.ToolBtn} ${tool === 'pencil' ? styles.ToolBtn_active : ''}`}
                            onClick={() => setTool('pencil')}
                        >
                            <GestureOutlinedIcon fontSize="small" />
                            <span>Карандаш</span>
                        </button>
                        <button
                            type="button"
                            title="Ластик"
                            className={`${styles.ToolBtn} ${tool === 'eraser' ? styles.ToolBtn_active : ''}`}
                            onClick={() => setTool('eraser')}
                        >
                            <BackspaceOutlinedIcon fontSize="small" />
                            <span>Ластик</span>
                        </button>

                        {tool === 'line' ? (
                            <div className={styles.LineConfig}>
                                <Select
                                    label="Стиль"
                                    value={lineStyle}
                                    onChange={(v) => setLineStyle(v as LineStyle)}
                                    options={lineStyleOptions}
                                />
                                <Select
                                    label="Начало"
                                    value={lineStartEnding}
                                    onChange={(v) => setLineStartEnding(v as LineEnding)}
                                    options={endingOptions}
                                />
                                <Select
                                    label="Конец"
                                    value={lineEndEnding}
                                    onChange={(v) => setLineEndEnding(v as LineEnding)}
                                    options={endingOptions}
                                />
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className={styles.ZoomControls}>
                    <button
                        type="button"
                        className={styles.ZoomBtn}
                        title="Уменьшить (Ctrl+прокрутка)"
                        onClick={() => clampZoom(zoom - ZOOM_STEP)}
                    >
                        −
                    </button>
                    <button
                        type="button"
                        className={styles.ZoomLabel}
                        title="Сбросить масштаб"
                        onClick={() => setZoom(1)}
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        type="button"
                        className={styles.ZoomBtn}
                        title="Увеличить (Ctrl+прокрутка)"
                        onClick={() => clampZoom(zoom + ZOOM_STEP)}
                    >
                        +
                    </button>
                </div>
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
                            onDragStart={(event) => handlePaletteDragStart(event, blockTemplate.type)}
                        >
                            {blockTemplate.name}
                        </button>
                    ))}
                    <Typography variant="subtitle2" style={{ marginTop: 8 }}>
                        Фигуры
                    </Typography>
                    {SHAPE_BLOCK_TEMPLATES.map((blockTemplate) => (
                        <button
                            key={blockTemplate.type}
                            type="button"
                            className={`${styles.PaletteItem} ${styles[`PaletteItem_${blockTemplate.type}`]}`}
                            draggable={canEdit}
                            disabled={!canEdit}
                            onClick={() => handleAddBlock(blockTemplate)}
                            onDragStart={(event) => handlePaletteDragStart(event, blockTemplate.type)}
                        >
                            {blockTemplate.name}
                        </button>
                    ))}
                </aside>

                <div
                    ref={canvasRef}
                    className={`${styles.Canvas} ${isDrawing ? styles.Canvas_drawing : ''} ${tool === 'eraser' ? styles.Canvas_eraser : ''}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleCanvasDrop}
                >
                    <div
                        className={styles.CanvasContent}
                        style={{ transform: `scale(${zoom})` }}
                    >
                        {elements.length === 0 ? (
                            <Typography
                                className={styles.CanvasHint}
                                variant="body2"
                                color="text.secondary"
                            >
                                {t.diagrams.canvasHint}
                            </Typography>
                        ) : null}

                        <svg
                            className={`${styles.CanvasSvg} ${isDrawing ? styles.CanvasSvg_active : ''}`}
                            width="2000"
                            height="2000"
                            onPointerDown={handleSvgPointerDown}
                            onPointerMove={handleSvgPointerMove}
                            onPointerUp={handleSvgPointerUp}
                        >
                            <SvgDefs />
                            {elements.filter(isLine).map((line) => (
                                <line
                                    key={line.id}
                                    x1={line.x1}
                                    y1={line.y1}
                                    x2={line.x2}
                                    y2={line.y2}
                                    stroke="var(--text-color)"
                                    strokeWidth="2"
                                    strokeDasharray={dashArray(line.style)}
                                    markerEnd={markerEnd(line.endEnding)}
                                    markerStart={markerStart(line.startEnding)}
                                    style={{
                                        cursor: tool === 'eraser' ? 'pointer' : 'default',
                                        pointerEvents: tool === 'eraser' ? 'stroke' : 'none',
                                    }}
                                    onClick={() => tool === 'eraser' && removeElement(line.id)}
                                />
                            ))}
                            {elements.filter(isPencil).map((pencil) => (
                                <path
                                    key={pencil.id}
                                    d={pointsToPath(pencil.points)}
                                    fill="none"
                                    stroke="var(--text-color)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                        cursor: tool === 'eraser' ? 'pointer' : 'default',
                                        pointerEvents: tool === 'eraser' ? 'stroke' : 'none',
                                    }}
                                    onClick={() => tool === 'eraser' && removeElement(pencil.id)}
                                />
                            ))}
                            {activeLineStart && activeLineCurrent ? (
                                <line
                                    x1={activeLineStart.x}
                                    y1={activeLineStart.y}
                                    x2={activeLineCurrent.x}
                                    y2={activeLineCurrent.y}
                                    stroke="var(--primary)"
                                    strokeWidth="2"
                                    strokeDasharray={dashArray(lineStyle)}
                                    markerEnd={markerEnd(lineEndEnding)}
                                    markerStart={markerStart(lineStartEnding)}
                                    opacity="0.7"
                                    style={{ pointerEvents: 'none' }}
                                />
                            ) : null}
                            {pencilPreview.length > 1 ? (
                                <path
                                    d={pointsToPath(pencilPreview)}
                                    fill="none"
                                    stroke="var(--primary)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity="0.7"
                                    style={{ pointerEvents: 'none' }}
                                />
                            ) : null}
                        </svg>

                        {elements.filter(isBlock).map((block) => {
                            const isEditing = editing?.id === block.id;
                            const isShape = isShapeBlockType(block.type);
                            return (
                                <div
                                    key={block.id}
                                    className={`${styles.Block} ${styles[`Block_${block.type}`]} ${isShape ? styles.Block_shape : ''}`}
                                    style={{
                                        left: block.x,
                                        top: block.y,
                                        width: block.width,
                                        height: block.height,
                                        cursor: tool === 'eraser' ? 'pointer' : undefined,
                                    }}
                                    onPointerDown={(event) => handleBlockPointerDown(event, block)}
                                    onDoubleClick={() => startEditing(block)}
                                >
                                    {isEditing ? (
                                        <div className={styles.BlockEditForm}>
                                            <input
                                                className={styles.BlockEditTitle}
                                                value={editing.title}
                                                autoFocus
                                                onChange={(e) =>
                                                    setEditing({ ...editing, title: e.target.value })
                                                }
                                                onBlur={commitEdit}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        commitEdit();
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setEditing(null);
                                                    }
                                                }}
                                            />
                                            {!isShape ? (
                                                <textarea
                                                    className={styles.BlockEditBody}
                                                    value={editing.body}
                                                    onChange={(e) =>
                                                        setEditing({ ...editing, body: e.target.value })
                                                    }
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            setEditing(null);
                                                        }
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                    ) : isShape ? (
                                        <div className={styles.BlockShapeContent}>
                                            {block.type === 'diamond' ? (
                                                <svg className={styles.ShapeSvg} viewBox="0 0 100 70" preserveAspectRatio="none">
                                                    <polygon points="50,2 98,35 50,68 2,35" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                                </svg>
                                            ) : block.type === 'triangle' ? (
                                                <svg className={styles.ShapeSvg} viewBox="0 0 100 80" preserveAspectRatio="none">
                                                    <polygon points="50,2 98,78 2,78" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                                </svg>
                                            ) : null}
                                            <span className={styles.ShapeLabel}>{block.title}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className={styles.BlockHeader}
                                                style={{ cursor: tool === 'eraser' ? 'pointer' : 'move' }}
                                            >
                                                {block.title}
                                            </div>
                                            <pre className={styles.BlockBody}>{block.body}</pre>
                                        </>
                                    )}
                                    {canEdit && tool === 'select' && !isEditing ? (
                                        <button
                                            type="button"
                                            aria-label="Resize block"
                                            className={styles.ResizeHandle}
                                            onPointerDown={(event) => handleBlockResize(event, block)}
                                        />
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
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
