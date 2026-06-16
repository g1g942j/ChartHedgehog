'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';

import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import GestureOutlinedIcon from '@mui/icons-material/GestureOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';

import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { TextField } from '@/shared/ui/TextField';
import { Typography } from '@/shared/ui/Typography';

import styles from './DiagramEditorPage.module.scss';

import {
    DIAGRAM_TEMPLATES,
    type DiagramBlockTemplate,
    type DiagramCanvasBlock,
    type DiagramEditorState,
    type DiagramElement,
    type DiagramLineElement,
    type DiagramPencilElement,
    type LineEnding,
    type LineStyle,
    fetchDiagramEditorState,
    isShapeBlockType,
    saveDiagramEditorState,
    SHAPE_BLOCK_TEMPLATES,
    UML_BLOCK_TEMPLATES,
} from '../api/diagramEditor';
import { deleteDiagram, updateDiagramName } from '../api/diagrams';

// ─── types ───────────────────────────────────────────────────────────────────

type DrawingTool = 'select' | 'eraser' | 'pencil' | 'line';
type LeftPanel = 'none' | 'shapes' | 'uml' | 'line-config' | 'templates';
type EditingBlock = { id: string; title: string; body: string };

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

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

// ─── helpers ──────────────────────────────────────────────────────────────────

function isBlock(el: DiagramElement): el is DiagramCanvasBlock {
    return !('kind' in el) || (el as { kind?: string }).kind === undefined;
}
function isLine(el: DiagramElement): el is DiagramLineElement {
    return 'kind' in el && (el as DiagramLineElement).kind === 'line';
}
function isPencil(el: DiagramElement): el is DiagramPencilElement {
    return 'kind' in el && (el as DiagramPencilElement).kind === 'pencil';
}
function pointsToPath(pts: [number, number][]): string {
    if (!pts.length) return '';
    const [f, ...rest] = pts;
    return `M ${f[0]} ${f[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')}`;
}
function dashArray(s: LineStyle): string | undefined {
    if (s === 'dashed') return '10,5';
    if (s === 'dotted') return '3,5';
}
function mEnd(e: LineEnding) {
    if (e === 'arrow') return 'url(#ch-arrow-end)';
    if (e === 'open-arrow') return 'url(#ch-open-arrow-end)';
    if (e === 'circle-end') return 'url(#ch-circle-end)';
}
function mStart(e: LineEnding) {
    if (e === 'arrow') return 'url(#ch-arrow-start)';
    if (e === 'open-arrow') return 'url(#ch-open-arrow-start)';
    if (e === 'circle-end') return 'url(#ch-circle-start)';
}

function SvgDefs() {
    return (
        <defs>
            <marker id="ch-arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0,10 3.5,0 7" fill="var(--text-color)" />
            </marker>
            <marker id="ch-open-arrow-end" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <polyline points="0,1 9,4 0,7" fill="none" stroke="var(--text-color)" strokeWidth="1.5" />
            </marker>
            <marker id="ch-circle-end" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <circle cx="4" cy="4" r="3" fill="var(--text-color)" />
            </marker>
            <marker id="ch-arrow-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                <polygon points="0 0,10 3.5,0 7" fill="var(--text-color)" />
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

// ─── props ────────────────────────────────────────────────────────────────────

export type DiagramEditorPageProps = {
    diagramId: number;
    diagramName: string;
    currentUserRole: string;
    initialEditorState: DiagramEditorState;
};

// ─── main component ───────────────────────────────────────────────────────────

export function DiagramEditorPage(props: DiagramEditorPageProps) {
    const { diagramId, diagramName, currentUserRole, initialEditorState } = props;
    const { t } = useLocale();
    const router = useRouter();
    const queryClient = useQueryClient();
    const canvasRef = useRef<HTMLDivElement | null>(null);

    const canEdit = currentUserRole === 'OWNER' || currentUserRole === 'EDITOR';
    const canDelete = currentUserRole === 'OWNER';

    // ── canvas state ──────────────────────────────────────────────────────────
    const [elements, setElements] = useState<DiagramElement[]>(initialEditorState.blocks);
    const [template, setTemplate] = useState(initialEditorState.template ?? 'uml');
    const [zoom, setZoom] = useState(1);
    const [editing, setEditing] = useState<EditingBlock | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [canvasError, setCanvasError] = useState<string | null>(null);

    // ── drawing state ─────────────────────────────────────────────────────────
    const [tool, setTool] = useState<DrawingTool>('select');
    const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
    const [lineStartEnding, setLineStartEnding] = useState<LineEnding>('none');
    const [lineEndEnding, setLineEndEnding] = useState<LineEnding>('arrow');
    const [activeLineStart, setActiveLineStart] = useState<{ x: number; y: number } | null>(null);
    const [activeLineCurrent, setActiveLineCurrent] = useState<{ x: number; y: number } | null>(null);
    const activePencilRef = useRef<{ id: string; points: [number, number][] } | null>(null);
    const [pencilPreview, setPencilPreview] = useState<[number, number][]>([]);

    // ── UI panels ─────────────────────────────────────────────────────────────
    const [leftPanel, setLeftPanel] = useState<LeftPanel>('none');
    const [menuOpen, setMenuOpen] = useState(false);
    const [templatesOpen, setTemplatesOpen] = useState(false);

    // ── settings form ─────────────────────────────────────────────────────────
    const [renaming, setRenaming] = useState(diagramName);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    // ── zoom wheel ────────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom((z) => parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)).toFixed(1)));
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, []);

    const clampZoom = (v: number) =>
        setZoom(parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v)).toFixed(1)));

    // ── canvas coordinate helper ──────────────────────────────────────────────
    const getCanvasPoint = (clientX: number, clientY: number) => {
        const el = canvasRef.current;
        if (!el) return { x: 0, y: 0 };
        const r = el.getBoundingClientRect();
        return {
            x: (clientX - r.left + el.scrollLeft) / zoom,
            y: (clientY - r.top + el.scrollTop) / zoom,
        };
    };

    // ── element helpers ───────────────────────────────────────────────────────
    const updateEl = (id: string, patch: Partial<DiagramCanvasBlock>) =>
        setElements((cur) => cur.map((el) => (isBlock(el) && el.id === id ? { ...el, ...patch } : el)));

    const removeEl = (id: string) => setElements((cur) => cur.filter((el) => el.id !== id));

    const createBlock = (tpl: DiagramBlockTemplate, id: string, x = 100, y = 100): DiagramCanvasBlock => ({
        id, type: tpl.type, title: tpl.title, body: tpl.body, x, y, width: tpl.width, height: tpl.height,
    });

    const addBlock = (tpl: DiagramBlockTemplate) => {
        const id = `${tpl.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setElements((cur) => [
            ...cur,
            createBlock(tpl, id, 100 + cur.filter(isBlock).length * 20, 100),
        ]);
    };

    // ── editing ───────────────────────────────────────────────────────────────
    const startEditing = (block: DiagramCanvasBlock) => {
        if (!canEdit || tool !== 'select') return;
        setEditing({ id: block.id, title: block.title, body: block.body });
    };
    const commitEdit = () => {
        if (!editing) return;
        updateEl(editing.id, { title: editing.title, body: editing.body });
        setEditing(null);
    };

    // ── drag-drop ─────────────────────────────────────────────────────────────
    const onDragStart = (e: DragEvent<HTMLButtonElement>, type: string) =>
        e.dataTransfer.setData('application/chart-hedgehog-block', type);

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!canEdit) return;
        const blockType = e.dataTransfer.getData('application/chart-hedgehog-block');
        const tpl = [...UML_BLOCK_TEMPLATES, ...SHAPE_BLOCK_TEMPLATES].find((t) => t.type === blockType);
        if (!tpl) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);
        const id = `${tpl.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setElements((cur) => [...cur, createBlock(tpl, id, Math.max(0, pt.x - 40), Math.max(0, pt.y - 24))]);
    };

    // ── block pointer events ──────────────────────────────────────────────────
    const onBlockPointerDown = (e: ReactPointerEvent<HTMLDivElement>, block: DiagramCanvasBlock) => {
        if (!canEdit || editing?.id === block.id) return;
        if (tool === 'eraser') { removeEl(block.id); return; }
        if (tool !== 'select') return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const sx = e.clientX, sy = e.clientY, bx = block.x, by = block.y;
        const move = (me: PointerEvent) => updateEl(block.id, {
            x: Math.max(0, bx + (me.clientX - sx) / zoom),
            y: Math.max(0, by + (me.clientY - sy) / zoom),
        });
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const onBlockResize = (e: ReactPointerEvent<HTMLButtonElement>, block: DiagramCanvasBlock) => {
        if (!canEdit || tool !== 'select') return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const sx = e.clientX, sy = e.clientY, sw = block.width, sh = block.height;
        const move = (me: PointerEvent) => updateEl(block.id, {
            width: Math.max(80, sw + (me.clientX - sx) / zoom),
            height: Math.max(60, sh + (me.clientY - sy) / zoom),
        });
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // ── SVG pointer events ────────────────────────────────────────────────────
    const onSvgDown = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);
        if (tool === 'line') { setActiveLineStart(pt); setActiveLineCurrent(pt); }
        else if (tool === 'pencil') {
            const id = `pencil-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            activePencilRef.current = { id, points: [[pt.x, pt.y]] };
            setPencilPreview([[pt.x, pt.y]]);
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };
    const onSvgMove = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);
        if (tool === 'line' && activeLineStart) setActiveLineCurrent(pt);
        else if (tool === 'pencil' && activePencilRef.current) {
            activePencilRef.current.points.push([pt.x, pt.y]);
            setPencilPreview([...activePencilRef.current.points]);
        }
    };
    const onSvgUp = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);
        if (tool === 'line' && activeLineStart) {
            if (Math.hypot(pt.x - activeLineStart.x, pt.y - activeLineStart.y) > 8) {
                const line: DiagramLineElement = {
                    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    kind: 'line', x1: activeLineStart.x, y1: activeLineStart.y, x2: pt.x, y2: pt.y,
                    style: lineStyle, startEnding: lineStartEnding, endEnding: lineEndEnding,
                };
                setElements((cur) => [...cur, line]);
            }
            setActiveLineStart(null); setActiveLineCurrent(null);
        } else if (tool === 'pencil' && activePencilRef.current) {
            const { id, points } = activePencilRef.current;
            if (points.length > 2) setElements((cur) => [...cur, { id, kind: 'pencil', points } as DiagramPencilElement]);
            activePencilRef.current = null; setPencilPreview([]);
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    // ── save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setIsSaving(true); setCanvasError(null);
        try {
            await saveDiagramEditorState(diagramId, { template, blocks: elements });
            await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
            await queryClient.invalidateQueries({ queryKey: ['diagramEditor', diagramId] });
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
        } catch (err) {
            setCanvasError(err instanceof Error ? err.message : t.diagrams.saveContentError);
        } finally { setIsSaving(false); }
    };

    // ── rename / delete ───────────────────────────────────────────────────────
    const handleRename = async () => {
        setIsRenaming(true); setSettingsError(null);
        try {
            await updateDiagramName(diagramId, renaming);
            await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
            setMenuOpen(false);
        } catch (err) {
            setSettingsError(err instanceof Error ? err.message : t.diagrams.updateError);
        } finally { setIsRenaming(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm(t.diagrams.deleteConfirm(renaming))) return;
        setIsDeleting(true); setSettingsError(null);
        try {
            await deleteDiagram(diagramId);
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
            router.replace('/diagrams');
        } catch (err) {
            setSettingsError(err instanceof Error ? err.message : t.diagrams.deleteError);
            setIsDeleting(false);
        }
    };

    // ── toolbar helpers ───────────────────────────────────────────────────────
    const togglePanel = (panel: LeftPanel) =>
        setLeftPanel((cur) => (cur === panel ? 'none' : panel));

    const selectTool = (t: DrawingTool) => {
        setTool(t);
        if (t === 'line') togglePanel('line-config');
        else setLeftPanel('none');
    };

    const applyTemplate = (id: string) => {
        const tpl = DIAGRAM_TEMPLATES.find((t) => t.id === id);
        if (tpl) { setElements(tpl.blocks); setTemplate(id); }
        setTemplatesOpen(false);
        setLeftPanel('none');
    };

    // ── options ───────────────────────────────────────────────────────────────
    const lineStyleOpts = useMemo<SelectOption[]>(
        () => LINE_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label })), [],
    );
    const endingOpts = useMemo<SelectOption[]>(
        () => ENDING_OPTIONS.map((o) => ({ value: o.value, label: o.label })), [],
    );

    const isDrawing = tool === 'line' || tool === 'pencil';

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className={styles.Page}>

            {/* ── TOP BAR ── */}
            <header className={styles.TopBar}>
                <button
                    type="button"
                    className={styles.TopBarBtn}
                    title={t.common.backToList}
                    onClick={() => router.push('/diagrams')}
                >
                    <ArrowBackOutlinedIcon fontSize="small" />
                </button>

                <span className={styles.DiagramName}>{renaming !== diagramName ? renaming : diagramName}</span>

                <div className={styles.TopBarRight}>
                    {canEdit ? (
                        <Button
                            variant="contained"
                            size="small"
                            loading={isSaving}
                            onClick={() => void handleSave()}
                        >
                            {t.diagrams.saveContent}
                        </Button>
                    ) : null}
                    <button
                        type="button"
                        className={`${styles.TopBarBtn} ${menuOpen ? styles.TopBarBtn_active : ''}`}
                        title="Настройки"
                        onClick={() => { setMenuOpen((o) => !o); setTemplatesOpen(false); }}
                    >
                        <MoreVertOutlinedIcon fontSize="small" />
                    </button>
                </div>
            </header>

            {/* ── SETTINGS PANEL (⋮ menu) ── */}
            {menuOpen ? (
                <>
                    <div className={styles.Overlay} onClick={() => setMenuOpen(false)} />
                    <aside className={styles.SettingsPanel}>
                        <Typography variant="subtitle2" style={{ marginBottom: 12 }}>
                            {t.diagrams.settingsTitle}
                        </Typography>
                        {settingsError ? (
                            <Alert severity="error" style={{ marginBottom: 8 }}>{settingsError}</Alert>
                        ) : null}

                        {canEdit ? (
                            <div className={styles.SettingsRow}>
                                <TextField
                                    label={t.diagrams.nameLabel}
                                    value={renaming}
                                    onChange={setRenaming}
                                    disabled={isRenaming || isDeleting}
                                />
                                <Button
                                    variant="outlined"
                                    size="small"
                                    loading={isRenaming}
                                    disabled={isDeleting || renaming.trim() === diagramName}
                                    onClick={() => void handleRename()}
                                >
                                    {t.diagrams.saveSettings}
                                </Button>
                            </div>
                        ) : null}

                        <Button
                            variant="outlined"
                            size="small"
                            component={Link}
                            href={`/diagrams/${diagramId}/participants`}
                            style={{ justifyContent: 'flex-start', gap: 8 }}
                            onClick={() => setMenuOpen(false)}
                        >
                            <GroupsOutlinedIcon fontSize="small" />
                            {t.common.participants}
                        </Button>

                        {canDelete ? (
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                loading={isDeleting}
                                disabled={isRenaming}
                                style={{ justifyContent: 'flex-start', gap: 8 }}
                                onClick={() => void handleDelete()}
                            >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                                {t.diagrams.deleteDiagram}
                            </Button>
                        ) : null}
                    </aside>
                </>
            ) : null}

            {/* ── BODY ── */}
            <div className={styles.Body}>

                {/* ── LEFT TOOLBAR ── */}
                <nav className={styles.LeftToolbar}>
                    <button
                        type="button"
                        title="Выбор / редактирование (двойной клик)"
                        className={`${styles.ToolBtn} ${tool === 'select' ? styles.ToolBtn_active : ''}`}
                        onClick={() => selectTool('select')}
                    >
                        <NearMeOutlinedIcon fontSize="small" />
                    </button>

                    {canEdit ? (
                        <>
                            <button
                                type="button"
                                title="Ластик"
                                className={`${styles.ToolBtn} ${tool === 'eraser' ? styles.ToolBtn_active : ''}`}
                                onClick={() => selectTool('eraser')}
                            >
                                <BackspaceOutlinedIcon fontSize="small" />
                            </button>

                            <button
                                type="button"
                                title="Карандаш"
                                className={`${styles.ToolBtn} ${tool === 'pencil' ? styles.ToolBtn_active : ''}`}
                                onClick={() => selectTool('pencil')}
                            >
                                <GestureOutlinedIcon fontSize="small" />
                            </button>

                            <button
                                type="button"
                                title="Линия"
                                className={`${styles.ToolBtn} ${tool === 'line' ? styles.ToolBtn_active : ''} ${leftPanel === 'line-config' ? styles.ToolBtn_panel : ''}`}
                                onClick={() => { selectTool('line'); togglePanel('line-config'); }}
                            >
                                <TimelineOutlinedIcon fontSize="small" />
                            </button>

                            <div className={styles.ToolbarDivider} />

                            <button
                                type="button"
                                title="Базовые элементы"
                                className={`${styles.ToolBtn} ${leftPanel === 'shapes' ? styles.ToolBtn_panel : ''}`}
                                onClick={() => togglePanel('shapes')}
                            >
                                <CategoryOutlinedIcon fontSize="small" />
                            </button>

                            <button
                                type="button"
                                title="Шаблоны"
                                className={`${styles.ToolBtn} ${templatesOpen || leftPanel === 'uml' ? styles.ToolBtn_panel : ''}`}
                                onClick={() => setTemplatesOpen((o) => !o)}
                            >
                                <TableChartOutlinedIcon fontSize="small" />
                            </button>
                        </>
                    ) : null}

                    <div className={styles.ToolbarSpacer} />

                    {/* zoom */}
                    <button type="button" className={styles.ZoomBtn} title="Уменьшить" onClick={() => clampZoom(zoom - ZOOM_STEP)}>−</button>
                    <button type="button" className={styles.ZoomLabel} title="Сбросить" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
                    <button type="button" className={styles.ZoomBtn} title="Увеличить" onClick={() => clampZoom(zoom + ZOOM_STEP)}>+</button>
                </nav>

                {/* ── LEFT PANELS ── */}
                {leftPanel === 'shapes' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Базовые элементы</Typography>
                        {SHAPE_BLOCK_TEMPLATES.map((tpl) => (
                            <button
                                key={tpl.type}
                                type="button"
                                className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`}
                                draggable
                                onClick={() => addBlock(tpl)}
                                onDragStart={(e) => onDragStart(e, tpl.type)}
                            >
                                {tpl.name}
                            </button>
                        ))}
                    </div>
                ) : leftPanel === 'uml' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>UML-блоки</Typography>
                        {UML_BLOCK_TEMPLATES.map((tpl) => (
                            <button
                                key={tpl.type}
                                type="button"
                                className={styles.PaletteItem}
                                draggable
                                onClick={() => addBlock(tpl)}
                                onDragStart={(e) => onDragStart(e, tpl.type)}
                            >
                                {tpl.name}
                            </button>
                        ))}
                    </div>
                ) : leftPanel === 'line-config' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Линия</Typography>
                        <Select label="Стиль" value={lineStyle} onChange={(v) => setLineStyle(v as LineStyle)} options={lineStyleOpts} />
                        <Select label="Начало" value={lineStartEnding} onChange={(v) => setLineStartEnding(v as LineEnding)} options={endingOpts} />
                        <Select label="Конец" value={lineEndEnding} onChange={(v) => setLineEndEnding(v as LineEnding)} options={endingOpts} />
                    </div>
                ) : null}

                {/* ── TEMPLATES DROPDOWN ── */}
                {templatesOpen ? (
                    <>
                        <div className={styles.Overlay} onClick={() => setTemplatesOpen(false)} />
                        <div className={styles.TemplatesDropdown}>
                            <Typography variant="subtitle2" className={styles.PanelTitle}>Шаблоны</Typography>
                            <button
                                type="button"
                                className={styles.TemplateItem}
                                onClick={() => { setTemplatesOpen(false); togglePanel('uml'); }}
                            >
                                <TableChartOutlinedIcon fontSize="small" />
                                UML
                            </button>
                        </div>
                    </>
                ) : null}

                {/* ── CANVAS ── */}
                {canvasError ? (
                    <Alert severity="error" style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }}>
                        {canvasError}
                    </Alert>
                ) : null}

                <div
                    ref={canvasRef}
                    className={`${styles.Canvas} ${isDrawing ? styles.Canvas_drawing : ''} ${tool === 'eraser' ? styles.Canvas_eraser : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                >
                    <div className={styles.CanvasContent} style={{ transform: `scale(${zoom})` }}>

                        <svg
                            className={`${styles.CanvasSvg} ${isDrawing ? styles.CanvasSvg_active : ''}`}
                            width="2000" height="2000"
                            onPointerDown={onSvgDown}
                            onPointerMove={onSvgMove}
                            onPointerUp={onSvgUp}
                        >
                            <SvgDefs />
                            {elements.filter(isLine).map((line) => (
                                <line
                                    key={line.id}
                                    x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                                    stroke="var(--text-color)" strokeWidth="2"
                                    strokeDasharray={dashArray(line.style)}
                                    markerEnd={mEnd(line.endEnding)} markerStart={mStart(line.startEnding)}
                                    style={{ cursor: tool === 'eraser' ? 'pointer' : 'default', pointerEvents: tool === 'eraser' ? 'stroke' : 'none' }}
                                    onClick={() => tool === 'eraser' && removeEl(line.id)}
                                />
                            ))}
                            {elements.filter(isPencil).map((p) => (
                                <path
                                    key={p.id} d={pointsToPath(p.points)}
                                    fill="none" stroke="var(--text-color)" strokeWidth="2"
                                    strokeLinecap="round" strokeLinejoin="round"
                                    style={{ cursor: tool === 'eraser' ? 'pointer' : 'default', pointerEvents: tool === 'eraser' ? 'stroke' : 'none' }}
                                    onClick={() => tool === 'eraser' && removeEl(p.id)}
                                />
                            ))}
                            {activeLineStart && activeLineCurrent ? (
                                <line
                                    x1={activeLineStart.x} y1={activeLineStart.y}
                                    x2={activeLineCurrent.x} y2={activeLineCurrent.y}
                                    stroke="var(--primary)" strokeWidth="2"
                                    strokeDasharray={dashArray(lineStyle)}
                                    markerEnd={mEnd(lineEndEnding)} markerStart={mStart(lineStartEnding)}
                                    opacity="0.7" style={{ pointerEvents: 'none' }}
                                />
                            ) : null}
                            {pencilPreview.length > 1 ? (
                                <path
                                    d={pointsToPath(pencilPreview)}
                                    fill="none" stroke="var(--primary)" strokeWidth="2"
                                    strokeLinecap="round" strokeLinejoin="round"
                                    opacity="0.7" style={{ pointerEvents: 'none' }}
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
                                    style={{ left: block.x, top: block.y, width: block.width, height: block.height, cursor: tool === 'eraser' ? 'pointer' : undefined }}
                                    onPointerDown={(e) => onBlockPointerDown(e, block)}
                                    onDoubleClick={() => startEditing(block)}
                                >
                                    {isEditing ? (
                                        <div className={styles.BlockEditForm}>
                                            <input
                                                className={styles.BlockEditTitle}
                                                value={editing.title}
                                                autoFocus
                                                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                                onBlur={commitEdit}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                                                    if (e.key === 'Escape') setEditing(null);
                                                }}
                                            />
                                            {!isShape ? (
                                                <textarea
                                                    className={styles.BlockEditBody}
                                                    value={editing.body}
                                                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
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
                                            <div className={styles.BlockHeader} style={{ cursor: tool === 'eraser' ? 'pointer' : 'move' }}>
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
                                            onPointerDown={(e) => onBlockResize(e, block)}
                                        />
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── wrapper (handles loading) ────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';

type DiagramEditorLoaderProps = {
    diagramId: number;
    diagramName: string;
    currentUserRole: string;
};

export function DiagramEditorLoader(props: DiagramEditorLoaderProps) {
    const { diagramId, diagramName, currentUserRole } = props;
    const { t } = useLocale();

    const q = useQuery({
        queryKey: ['diagramEditor', diagramId],
        queryFn: () => fetchDiagramEditorState(diagramId),
    });

    if (q.isPending) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <Typography color="text.secondary">{t.common.loading}</Typography>
            </div>
        );
    }

    if (q.error || !q.data) {
        return (
            <div style={{ padding: 32 }}>
                <Alert severity="error">
                    {q.error instanceof Error ? q.error.message : t.diagrams.saveContentError}
                </Alert>
            </div>
        );
    }

    return (
        <DiagramEditorPage
            key={`${diagramId}:${q.data.template ?? ''}:${q.data.blocks.length}`}
            diagramId={diagramId}
            diagramName={diagramName}
            currentUserRole={currentUserRole}
            initialEditorState={q.data}
        />
    );
}
