'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useQueryClient } from '@tanstack/react-query';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import GestureOutlinedIcon from '@mui/icons-material/GestureOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import RedoOutlinedIcon from '@mui/icons-material/RedoOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import TextFieldsOutlinedIcon from '@mui/icons-material/TextFieldsOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';

import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';

import { useLocale } from '@/shared/i18n';
import { useThemeMode } from '@/shared/theme';
import { useToast } from '@/shared/toast';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
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
    fetchDiagramEditorState,
    isShapeBlockType,
    type LineEnding,
    type LineStyle,
    saveDiagramEditorState,
    SHAPE_BLOCK_TEMPLATES,
    TEXT_BLOCK_TEMPLATES,
    UML_BLOCK_TEMPLATES,
} from '../api/diagramEditor';
import { deleteDiagram, updateDiagramName } from '../api/diagrams';

// ─── types ────────────────────────────────────────────────────────────────────

type DrawingTool = 'select' | 'pan' | 'eraser' | 'pencil' | 'line';
type LeftPanel = 'none' | 'shapes' | 'uml' | 'line-config' | 'templates' | 'text-panel';
type EditingBlock = { id: string; title: string; body: string };
type ExportFormat = 'json' | 'svg' | 'png' | 'jpeg' | 'pdf';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SelBox = { x1: number; y1: number; x2: number; y2: number };

function generateId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const HISTORY_LIMIT = 50;

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
function isTextBlock(el: DiagramCanvasBlock): boolean {
    return el.type === 'text' || el.type === 'comment';
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
    const { mode, toggleMode } = useThemeMode();
    const toast = useToast();
    const router = useRouter();
    const queryClient = useQueryClient();
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const canvasContentRef = useRef<HTMLDivElement | null>(null);

    const canEdit = currentUserRole === 'OWNER' || currentUserRole === 'EDITOR';
    const canDelete = currentUserRole === 'OWNER';

    // ── canvas state ──────────────────────────────────────────────────────────
    const [elements, setElements] = useState<DiagramElement[]>(initialEditorState.blocks);
    const [template, setTemplate] = useState(initialEditorState.template ?? 'uml');
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(40);
    const [panY, setPanY] = useState(40);
    const [editing, setEditing] = useState<EditingBlock | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [canvasError] = useState<string | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── history ───────────────────────────────────────────────────────────────
    const historyRef = useRef<DiagramElement[][]>([]);
    const futureRef = useRef<DiagramElement[][]>([]);
    const elementsRef = useRef<DiagramElement[]>(initialEditorState.blocks);
    const dragSnapshotRef = useRef<DiagramElement[] | null>(null);

    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    // ── selection ─────────────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selBox, setSelBox] = useState<SelBox | null>(null);
    const selBoxStartRef = useRef<{ x: number; y: number } | null>(null);

    // ── clipboard ─────────────────────────────────────────────────────────────
    const clipboardRef = useRef<DiagramCanvasBlock[]>([]);

    // ── drawing state ─────────────────────────────────────────────────────────
    const [tool, setTool] = useState<DrawingTool>('select');
    const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
    const [lineStartEnding, setLineStartEnding] = useState<LineEnding>('none');
    const [lineEndEnding, setLineEndEnding] = useState<LineEnding>('arrow');
    const [activeLineStart, setActiveLineStart] = useState<{ x: number; y: number } | null>(null);
    const [activeLineCurrent, setActiveLineCurrent] = useState<{ x: number; y: number } | null>(null);
    const activePencilRef = useRef<{ id: string; points: [number, number][] } | null>(null);
    const [pencilPreview, setPencilPreview] = useState<[number, number][]>([]);
    const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
    const [isPanning, setIsPanning] = useState(false);

    // ── UI panels ─────────────────────────────────────────────────────────────
    const [leftPanel, setLeftPanel] = useState<LeftPanel>('none');
    const [menuOpen, setMenuOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [transparentBg, setTransparentBg] = useState(false);
    const [shapeSearch, setShapeSearch] = useState('');

    // ── settings form ─────────────────────────────────────────────────────────
    const [renaming, setRenaming] = useState(diagramName);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const copyLink = () => {
        void navigator.clipboard.writeText(shareUrl).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    // ── history helpers ───────────────────────────────────────────────────────
    const pushHistory = useCallback(() => {
        historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), elementsRef.current];
        futureRef.current = [];
    }, []);

    const undo = useCallback(() => {
        const past = historyRef.current;
        if (!past.length) return;
        futureRef.current = [elementsRef.current, ...futureRef.current.slice(0, HISTORY_LIMIT - 1)];
        historyRef.current = past.slice(0, -1);
        setElements(past[past.length - 1]!);
        setSelectedIds(new Set());
    }, []);

    const redo = useCallback(() => {
        const future = futureRef.current;
        if (!future.length) return;
        historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), elementsRef.current];
        futureRef.current = future.slice(1);
        setElements(future[0]!);
        setSelectedIds(new Set());
    }, []);

    const copySelected = useCallback(() => {
        clipboardRef.current = elementsRef.current
            .filter(isBlock)
            .filter((b) => selectedIds.has(b.id));
    }, [selectedIds]);

    const paste = useCallback(() => {
        if (!clipboardRef.current.length || !canEdit) return;
        pushHistory();
        const OFFSET = 20;
        const newBlocks: DiagramCanvasBlock[] = clipboardRef.current.map((b) => ({
            ...b,
            id: generateId(b.type),
            x: b.x + OFFSET,
            y: b.y + OFFSET,
        }));
        setElements((cur) => [...cur, ...newBlocks]);
        setSelectedIds(new Set(newBlocks.map((b) => b.id)));
    }, [canEdit, pushHistory]);

    const deleteSelected = useCallback(() => {
        if (!selectedIds.size || !canEdit) return;
        pushHistory();
        setElements((cur) => cur.filter((el) => !selectedIds.has((el as { id?: string }).id ?? '')));
        setSelectedIds(new Set());
    }, [canEdit, pushHistory, selectedIds]);

    // ── keyboard shortcuts ────────────────────────────────────────────────────
    const keyActionsRef = useRef({ undo, redo, copySelected, paste, deleteSelected });
    useEffect(() => {
        keyActionsRef.current = { undo, redo, copySelected, paste, deleteSelected };
    });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const a = keyActionsRef.current;
            if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                a.undo();
            } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                a.redo();
            } else if (e.ctrlKey && e.key === 'c') {
                a.copySelected();
            } else if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                a.paste();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey) {
                e.preventDefault();
                a.deleteSelected();
            } else if (e.key === 'Escape') {
                setSelectedIds(new Set());
                setEditing(null);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── save ──────────────────────────────────────────────────────────────────
    const saveNow = useCallback(async (els: DiagramElement[]) => {
        setSaveStatus('saving');
        try {
            await saveDiagramEditorState(diagramId, { template, blocks: els });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
        }
    }, [diagramId, template]);

    useEffect(() => {
        if (!canEdit) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => void saveNow(elements), 2000);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [elements, canEdit, saveNow]);

    // ── zoom wheel ────────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom((z) => {
                const nz = parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)).toFixed(2));
                setPanX((px) => mx - (mx - px) * (nz / z));
                setPanY((py) => my - (my - py) * (nz / z));
                return nz;
            });
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, []);

    const clampZoom = (nz: number) => {
        const canvas = canvasRef.current;
        const clamped = parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nz)).toFixed(2));
        if (canvas) {
            const cx = canvas.getBoundingClientRect().width / 2;
            const cy = canvas.getBoundingClientRect().height / 2;
            setPanX((px) => cx - (cx - px) * (clamped / zoom));
            setPanY((py) => cy - (cy - py) * (clamped / zoom));
        }
        setZoom(clamped);
    };

    // ── canvas coordinate helper ──────────────────────────────────────────────
    const getCanvasPoint = (clientX: number, clientY: number) => {
        const el = canvasRef.current;
        if (!el) return { x: 0, y: 0 };
        const r = el.getBoundingClientRect();
        return {
            x: (clientX - r.left - panX) / zoom,
            y: (clientY - r.top - panY) / zoom,
        };
    };

    // ── canvas pointer events ─────────────────────────────────────────────────
    const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if ((e.target as Element).closest('[data-block]')) return;

        if (tool === 'pan') {
            e.currentTarget.setPointerCapture(e.pointerId);
            panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: panX, scrollTop: panY };
            setIsPanning(true);
            return;
        }

        if (tool === 'select') {
            setSelectedIds(new Set());
            setEditing(null);
            const pt = getCanvasPoint(e.clientX, e.clientY);
            selBoxStartRef.current = pt;
            setSelBox({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
        }

        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);

        if (tool === 'line') {
            setActiveLineStart(pt);
            setActiveLineCurrent(pt);
            e.currentTarget.setPointerCapture(e.pointerId);
        } else if (tool === 'pencil') {
            const id = generateId('pencil');
            activePencilRef.current = { id, points: [[pt.x, pt.y]] };
            setPencilPreview([[pt.x, pt.y]]);
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };

    const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (tool === 'pan') {
            if (!panRef.current) return;
            setPanX(panRef.current.scrollLeft + (e.clientX - panRef.current.startX));
            setPanY(panRef.current.scrollTop + (e.clientY - panRef.current.startY));
            return;
        }

        if (tool === 'select' && selBoxStartRef.current) {
            const pt = getCanvasPoint(e.clientX, e.clientY);
            setSelBox({ x1: selBoxStartRef.current.x, y1: selBoxStartRef.current.y, x2: pt.x, y2: pt.y });
            return;
        }

        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);

        if (tool === 'line' && activeLineStart) {
            setActiveLineCurrent(pt);
        } else if (tool === 'pencil' && activePencilRef.current) {
            activePencilRef.current.points.push([pt.x, pt.y]);
            setPencilPreview([...activePencilRef.current.points]);
        }
    };

    const onCanvasPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (tool === 'pan') {
            panRef.current = null;
            setIsPanning(false);
            return;
        }

        if (tool === 'select') {
            if (selBox) {
                const minX = Math.min(selBox.x1, selBox.x2);
                const maxX = Math.max(selBox.x1, selBox.x2);
                const minY = Math.min(selBox.y1, selBox.y2);
                const maxY = Math.max(selBox.y1, selBox.y2);
                const SIZE_THRESHOLD = 6;
                if (maxX - minX > SIZE_THRESHOLD || maxY - minY > SIZE_THRESHOLD) {
                    const inBox = elements
                        .filter(isBlock)
                        .filter((b) => b.x < maxX && b.x + b.width > minX && b.y < maxY && b.y + b.height > minY);
                    setSelectedIds(new Set(inBox.map((b) => b.id)));
                }
                setSelBox(null);
                selBoxStartRef.current = null;
            }
            return;
        }

        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);

        if (tool === 'line' && activeLineStart) {
            if (Math.hypot(pt.x - activeLineStart.x, pt.y - activeLineStart.y) > 8) {
                pushHistory();
                const line: DiagramLineElement = {
                    id: generateId('line'),
                    kind: 'line', x1: activeLineStart.x, y1: activeLineStart.y, x2: pt.x, y2: pt.y,
                    style: lineStyle, startEnding: lineStartEnding, endEnding: lineEndEnding,
                };
                setElements((cur) => [...cur, line]);
            }
            setActiveLineStart(null);
            setActiveLineCurrent(null);
        } else if (tool === 'pencil' && activePencilRef.current) {
            const { id, points } = activePencilRef.current;
            if (points.length > 2) {
                pushHistory();
                setElements((cur) => [...cur, { id, kind: 'pencil', points } as DiagramPencilElement]);
            }
            activePencilRef.current = null;
            setPencilPreview([]);
        }
    };

    // ── element helpers ───────────────────────────────────────────────────────
    const updateEl = (id: string, patch: Partial<DiagramCanvasBlock>) =>
        setElements((cur) => cur.map((el) => (isBlock(el) && el.id === id ? { ...el, ...patch } : el)));

    const removeEl = (id: string) => setElements((cur) => cur.filter((el) => el.id !== id));

    const createBlock = (tpl: DiagramBlockTemplate, id: string, x = 100, y = 100): DiagramCanvasBlock => ({
        id, type: tpl.type, title: tpl.title, body: tpl.body, x, y, width: tpl.width, height: tpl.height,
    });

    const addBlock = (tpl: DiagramBlockTemplate) => {
        pushHistory();
        const id = generateId(tpl.type);
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
        pushHistory();
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
        const tpl = [...UML_BLOCK_TEMPLATES, ...SHAPE_BLOCK_TEMPLATES, ...TEXT_BLOCK_TEMPLATES].find((t) => t.type === blockType);
        if (!tpl) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);
        const id = generateId(tpl.type);
        pushHistory();
        setElements((cur) => [...cur, createBlock(tpl, id, pt.x - 40, pt.y - 24)]);
    };

    // ── block pointer events ──────────────────────────────────────────────────
    const onBlockPointerDown = (e: ReactPointerEvent<HTMLDivElement>, block: DiagramCanvasBlock) => {
        if (tool === 'pan') return;
        if (tool === 'eraser') {
            pushHistory();
            removeEl(block.id);
            return;
        }
        if (!canEdit || editing?.id === block.id) return;
        if (tool !== 'select') return;

        // Shift+click: toggle selection
        if (e.shiftKey) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(block.id)) next.delete(block.id);
                else next.add(block.id);
                return next;
            });
            return;
        }

        // Compute which IDs will move
        const moveIds: Set<string> = selectedIds.has(block.id) ? new Set(selectedIds) : new Set([block.id]);
        if (!selectedIds.has(block.id)) setSelectedIds(moveIds);

        e.currentTarget.setPointerCapture(e.pointerId);

        // Snapshot positions for group move
        const startPositions = new Map<string, { x: number; y: number }>(
            elementsRef.current
                .filter(isBlock)
                .filter((b) => moveIds.has(b.id))
                .map((b) => [b.id, { x: b.x, y: b.y }]),
        );

        const sx = e.clientX, sy = e.clientY;
        dragSnapshotRef.current = [...elementsRef.current];
        let moved = false;
        const currentZoom = zoom;

        const move = (me: PointerEvent) => {
            moved = true;
            const dx = (me.clientX - sx) / currentZoom;
            const dy = (me.clientY - sy) / currentZoom;
            setElements((cur) =>
                cur.map((el) => {
                    if (!isBlock(el) || !moveIds.has(el.id)) return el;
                    const start = startPositions.get(el.id);
                    if (!start) return el;
                    return { ...el, x: start.x + dx, y: start.y + dy };
                }),
            );
        };

        const up = () => {
            if (moved && dragSnapshotRef.current) {
                historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), dragSnapshotRef.current];
                futureRef.current = [];
            }
            dragSnapshotRef.current = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };

        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const onBlockResize = (e: ReactPointerEvent<HTMLButtonElement>, block: DiagramCanvasBlock) => {
        if (!canEdit || tool !== 'select') return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const sx = e.clientX, sy = e.clientY, sw = block.width, sh = block.height;
        dragSnapshotRef.current = [...elementsRef.current];
        const currentZoom = zoom;

        const move = (me: PointerEvent) => updateEl(block.id, {
            width: Math.max(80, sw + (me.clientX - sx) / currentZoom),
            height: Math.max(60, sh + (me.clientY - sy) / currentZoom),
        });
        const up = () => {
            if (dragSnapshotRef.current) {
                historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), dragSnapshotRef.current];
                futureRef.current = [];
                dragSnapshotRef.current = null;
            }
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // ── export ────────────────────────────────────────────────────────────────
    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const getContentBounds = () => {
        const PAD = 24;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of elements) {
            if (isBlock(el)) { minX = Math.min(minX, el.x); minY = Math.min(minY, el.y); maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height); }
            else if (isLine(el)) { minX = Math.min(minX, el.x1, el.x2); minY = Math.min(minY, el.y1, el.y2); maxX = Math.max(maxX, el.x1, el.x2); maxY = Math.max(maxY, el.y1, el.y2); }
            else if (isPencil(el)) { for (const [px, py] of el.points) { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); } }
        }
        if (!isFinite(minX)) return null;
        return { x: Math.max(0, minX - PAD), y: Math.max(0, minY - PAD), width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 };
    };

    const captureCanvas = async (transparent = false) => {
        const { default: html2canvas } = await import('html2canvas');
        const el = canvasContentRef.current;
        if (!el) throw new Error('Canvas not found');
        const savedZoom = zoom, savedPanX = panX, savedPanY = panY;
        setZoom(1); setPanX(0); setPanY(0);
        await new Promise<void>((r) => setTimeout(r, 150));
        const bounds = getContentBounds();
        const canvas = await html2canvas(el, {
            scale: 2, backgroundColor: transparent ? null : '#ffffff', useCORS: true, logging: false,
            onclone: (doc, cloned) => {
                const vars: Record<string, string> = { '--text-color': '#000000', '--primary': '#1a56db', '--primary-contrast': '#ffffff', '--surface': '#ffffff', '--bg-soft': '#f8f8f8', '--border': '#d0d0d0', '--text-secondary': '#555555' };
                Object.entries(vars).forEach(([k, v]) => doc.documentElement.style.setProperty(k, v));
                cloned.querySelectorAll<HTMLElement>('[class*="ResizeHandle"]').forEach((el) => { el.style.display = 'none'; });
                const drawingSvg = cloned.querySelector<SVGSVGElement>('[class*="CanvasSvg"]');
                if (drawingSvg) {
                    drawingSvg.querySelectorAll<SVGElement>(':scope > line, :scope > path').forEach((el) => { el.style.stroke = '#000000'; el.style.strokeWidth = '2px'; });
                    drawingSvg.querySelectorAll<SVGElement>('marker polygon').forEach((el) => { el.style.fill = '#000000'; el.style.stroke = 'none'; });
                    drawingSvg.querySelectorAll<SVGElement>('marker polyline').forEach((el) => { el.style.fill = 'none'; el.style.stroke = '#000000'; el.style.strokeWidth = '1.5px'; });
                    drawingSvg.querySelectorAll<SVGElement>('marker circle').forEach((el) => { el.style.fill = '#000000'; });
                }
            },
            ...(bounds ?? {}),
        });
        setZoom(savedZoom); setPanX(savedPanX); setPanY(savedPanY);
        return canvas;
    };

    const buildSvg = (transparent = false): string => {
        const PAD = 24;
        const bounds = getContentBounds();
        const vx = bounds ? bounds.x : 0, vy = bounds ? bounds.y : 0;
        const vw = bounds ? bounds.width : 800, vh = bounds ? bounds.height : 600;
        const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const defs = `<defs><marker id="e-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#000"/></marker><marker id="e-open" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polyline points="0,1 9,4 0,7" fill="none" stroke="#000" stroke-width="1.5"/></marker><marker id="e-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="3" fill="#000"/></marker><marker id="s-arrow" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse"><polygon points="0 0,10 3.5,0 7" fill="#000"/></marker><marker id="s-open" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse"><polyline points="0,1 9,4 0,7" fill="none" stroke="#000" stroke-width="1.5"/></marker><marker id="s-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><circle cx="4" cy="4" r="3" fill="#000"/></marker></defs>`;
        const endMarker = (e: LineEnding, prefix: 'e' | 's') => e === 'arrow' ? `url(#${prefix}-arrow)` : e === 'open-arrow' ? `url(#${prefix}-open)` : e === 'circle-end' ? `url(#${prefix}-circle)` : '';
        const strokeDash = (s: LineStyle) => s === 'dashed' ? 'stroke-dasharray="10,5"' : s === 'dotted' ? 'stroke-dasharray="3,5"' : '';
        const svgLines = elements.filter(isLine).map((l) => {
            const me = endMarker(l.endEnding, 'e'), ms = endMarker(l.startEnding, 's');
            return `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#000" stroke-width="2" ${strokeDash(l.style)} ${me ? `marker-end="${me}"` : ''} ${ms ? `marker-start="${ms}"` : ''}/>`;
        }).join('\n');
        const svgPencil = elements.filter(isPencil).map((p) => `<path d="${pointsToPath(p.points)}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n');
        const svgBlocks = elements.filter(isBlock).map((b) => {
            const x = b.x, y = b.y, w = b.width, h = b.height;
            if (b.type === 'text') return `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#000">${escXml(b.title)}</text>`;
            if (b.type === 'comment') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fefce8" stroke="#eab308" stroke-width="1.5" rx="8"/><text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#78350f">${escXml(b.title)}</text>`;
            const isShape = isShapeBlockType(b.type);
            if (isShape) {
                const shapeColors: Record<string, string> = { rectangle: '#3b82f6', circle: '#ec4899', diamond: '#f59e0b', triangle: '#22c55e', sticky: '#eab308' };
                const color = shapeColors[b.type] ?? '#3b82f6';
                let shapeEl = '';
                if (b.type === 'rectangle') shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(59,130,246,0.07)" stroke="${color}" stroke-width="2.5" rx="6"/>`;
                else if (b.type === 'circle') shapeEl = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="rgba(236,72,153,0.07)" stroke="${color}" stroke-width="2.5"/>`;
                else if (b.type === 'diamond') shapeEl = `<polygon points="${x + w / 2},${y + PAD / 2} ${x + w - PAD / 2},${y + h / 2} ${x + w / 2},${y + h - PAD / 2} ${x + PAD / 2},${y + h / 2}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
                else if (b.type === 'triangle') shapeEl = `<polygon points="${x + w / 2},${y + PAD / 2} ${x + w - PAD / 2},${y + h - PAD / 2} ${x + PAD / 2},${y + h - PAD / 2}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
                else if (b.type === 'sticky') shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fef9c3" stroke="#eab308" stroke-width="2" rx="4"/>`;
                return `${shapeEl}\n<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="600" fill="${color}">${escXml(b.title)}</text>`;
            }
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#1a56db" stroke-width="2" rx="10"/>
<rect x="${x}" y="${y}" width="${w}" height="32" fill="#1a56db" rx="10"/>
<rect x="${x}" y="${y + 22}" width="${w}" height="10" fill="#1a56db"/>
<text x="${x + w / 2}" y="${y + 16}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#fff">${escXml(b.title)}</text>
<text x="${x + 10}" y="${y + 48}" font-size="12" fill="#000" font-family="Consolas,monospace">${escXml(b.body)}</text>`;
        }).join('\n');
        const bgRect = transparent ? '' : `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">\n${defs}\n${bgRect}\n${svgLines}\n${svgPencil}\n${svgBlocks}\n</svg>`;
    };

    const handleExport = async (format: ExportFormat) => {
        setIsExporting(true);
        try {
            const fname = renaming || diagramName || 'diagram';
            if (format === 'json') { downloadBlob(new Blob([JSON.stringify(elements, null, 2)], { type: 'application/json' }), `${fname}.json`); setExportOpen(false); return; }
            if (format === 'svg') { downloadBlob(new Blob([buildSvg(transparentBg)], { type: 'image/svg+xml' }), `${fname}.svg`); setExportOpen(false); return; }
            const canvas = await captureCanvas(transparentBg);
            if (format === 'png') { canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${fname}.png`); }, 'image/png'); }
            else if (format === 'jpeg') { canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${fname}.jpeg`); }, 'image/jpeg', 0.92); }
            else if (format === 'pdf') {
                const { jsPDF } = await import('jspdf');
                const imgData = canvas.toDataURL('image/png');
                const w = canvas.width / 2, h = canvas.height / 2;
                const pdf = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
                pdf.addImage(imgData, 'PNG', 0, 0, w, h);
                pdf.save(`${fname}.pdf`);
            }
            setExportOpen(false);
        } catch (err) { console.error('Export failed', err); }
        finally { setIsExporting(false); }
    };

    // ── rename / delete ───────────────────────────────────────────────────────
    const handleRename = async () => {
        setIsRenaming(true);
        try {
            await updateDiagramName(diagramId, renaming);
            await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
            toast.success('Название сохранено');
            setMenuOpen(false);
        } catch (err) { toast.error(err instanceof Error ? err.message : t.diagrams.updateError); }
        finally { setIsRenaming(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm(t.diagrams.deleteConfirm(renaming))) return;
        setIsDeleting(true);
        try {
            await deleteDiagram(diagramId);
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
            router.replace('/diagrams');
        } catch (err) { toast.error(err instanceof Error ? err.message : t.diagrams.deleteError); setIsDeleting(false); }
    };

    // ── toolbar helpers ───────────────────────────────────────────────────────
    const togglePanel = (panel: LeftPanel) =>
        setLeftPanel((cur) => (cur === panel ? 'none' : panel));

    const selectTool = (t: DrawingTool) => {
        setTool(t);
        if (t !== 'select' && t !== 'pan') setLeftPanel('none');
    };

    const _applyTemplate = (id: string) => {
        const tpl = DIAGRAM_TEMPLATES.find((t) => t.id === id);
        if (tpl) { setElements(tpl.blocks); setTemplate(id); }
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

    const filteredShapes = useMemo(() => {
        const q = shapeSearch.trim().toLowerCase();
        if (!q) return SHAPE_BLOCK_TEMPLATES;
        return SHAPE_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q));
    }, [shapeSearch]);

    const filteredUml = useMemo(() => {
        const q = shapeSearch.trim().toLowerCase();
        if (!q) return UML_BLOCK_TEMPLATES;
        return UML_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q));
    }, [shapeSearch]);

    const filteredText = useMemo(() => {
        const q = shapeSearch.trim().toLowerCase();
        if (!q) return TEXT_BLOCK_TEMPLATES;
        return TEXT_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q));
    }, [shapeSearch]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className={styles.Page}>

            {/* ── TOP BAR ── */}
            <header className={styles.TopBar}>
                <button type="button" className={styles.TopBarBtn} title={t.common.backToList} onClick={() => router.push('/diagrams')}>
                    <ArrowBackOutlinedIcon fontSize="small" />
                </button>

                <span className={styles.DiagramName}>{renaming !== diagramName ? renaming : diagramName}</span>
                {canEdit && saveStatus !== 'idle' ? (
                    <span className={`${styles.SaveStatus} ${styles[`SaveStatus_${saveStatus}`]}`}>
                        {saveStatus === 'saving' ? 'Сохранение…' : saveStatus === 'saved' ? '✓ Сохранено' : 'Ошибка сохранения'}
                    </span>
                ) : null}

                <div className={styles.TopBarRight}>
                    {canEdit ? (
                        <>
                            <button type="button" className={styles.TopBarBtn} title="Отменить (Ctrl+Z)" onClick={undo}>
                                <UndoOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" className={styles.TopBarBtn} title="Повторить (Ctrl+Y)" onClick={redo}>
                                <RedoOutlinedIcon fontSize="small" />
                            </button>
                        </>
                    ) : null}
                    <button type="button" className={styles.TopBarBtn} title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'} onClick={toggleMode}>
                        {mode === 'dark' ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
                    </button>
                    <button type="button" className={styles.TopBarBtn} title="Скачать диаграмму" onClick={() => { setExportOpen(true); setMenuOpen(false); }}>
                        <FileDownloadOutlinedIcon fontSize="small" />
                    </button>
                    <button type="button" className={`${styles.TopBarBtn} ${menuOpen ? styles.TopBarBtn_active : ''}`} title="Настройки" onClick={() => { setMenuOpen((o) => !o); setLeftPanel('none'); }}>
                        <MoreVertOutlinedIcon fontSize="small" />
                    </button>
                </div>
            </header>

            {/* ── SETTINGS PANEL ── */}
            {menuOpen ? (
                <>
                    <div className={styles.Overlay} onClick={() => setMenuOpen(false)} />
                    <aside className={styles.SettingsPanel}>
                        <Typography variant="subtitle2" style={{ marginBottom: 12 }}>{t.diagrams.settingsTitle}</Typography>
                        {canEdit ? (
                            <div className={styles.SettingsRow}>
                                <TextField label={t.diagrams.nameLabel} value={renaming} onChange={setRenaming} disabled={isRenaming || isDeleting} />
                                <Button variant="outlined" size="small" loading={isRenaming} disabled={isDeleting || renaming.trim() === diagramName} onClick={() => void handleRename()}>
                                    {t.diagrams.saveSettings}
                                </Button>
                            </div>
                        ) : null}
                        <div className={styles.SettingsRow}>
                            <Typography variant="caption" style={{ fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary, #888)' }}>Доступ</Typography>
                            <label className={styles.PublicToggle}>
                                <span>Публичный просмотр</span>
                                <button type="button" role="switch" aria-checked={isPublic} className={`${styles.ToggleSwitch} ${isPublic ? styles.ToggleSwitch_on : ''}`} onClick={() => setIsPublic((v) => !v)} />
                            </label>
                            <div className={styles.ShareLinkRow}>
                                <span className={styles.ShareLinkText} title={shareUrl}>{shareUrl}</span>
                                <button type="button" className={styles.CopyBtn} onClick={copyLink}>{linkCopied ? '✓' : 'Копировать'}</button>
                            </div>
                        </div>
                        <Button variant="outlined" size="small" component={Link} href={`/diagrams/${diagramId}/participants`} style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setMenuOpen(false)}>
                            <GroupsOutlinedIcon fontSize="small" />{t.common.participants}
                        </Button>
                        {canDelete ? (
                            <Button variant="outlined" color="error" size="small" loading={isDeleting} disabled={isRenaming} style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => void handleDelete()}>
                                <DeleteOutlineOutlinedIcon fontSize="small" />{t.diagrams.deleteDiagram}
                            </Button>
                        ) : null}
                    </aside>
                </>
            ) : null}

            {/* ── EXPORT MODAL ── */}
            {exportOpen ? (
                <>
                    <div className={styles.ModalOverlay} onClick={() => !isExporting && setExportOpen(false)} />
                    <div className={styles.Modal} role="dialog" aria-modal="true">
                        <Typography variant="subtitle1" style={{ marginBottom: 4 }}>Скачать диаграмму</Typography>
                        <Typography variant="body2" color="text.secondary" style={{ marginBottom: 16 }}>Выберите формат файла</Typography>
                        <label className={styles.TransparentToggle}>
                            <input type="checkbox" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)} />
                            Прозрачный фон <span className={styles.TransparentNote}>(PNG, SVG)</span>
                        </label>
                        <div className={styles.FormatGrid}>
                            {(['json', 'svg', 'png', 'jpeg', 'pdf'] as ExportFormat[]).map((fmt) => (
                                <button key={fmt} type="button" className={styles.FormatBtn} disabled={isExporting} onClick={() => void handleExport(fmt)}>
                                    <span className={styles.FormatExt}>{fmt.toUpperCase()}</span>
                                    <span className={styles.FormatDesc}>{fmt === 'json' ? 'Данные' : fmt === 'svg' ? 'Вектор SVG' : fmt === 'png' ? 'PNG' : fmt === 'jpeg' ? 'JPEG' : 'PDF'}</span>
                                </button>
                            ))}
                        </div>
                        {isExporting ? <Typography variant="body2" color="text.secondary" style={{ marginTop: 12, textAlign: 'center' }}>Экспорт…</Typography> : null}
                    </div>
                </>
            ) : null}

            {/* ── BODY ── */}
            <div className={styles.Body}>

                {/* ── LEFT TOOLBAR ── */}
                <nav className={styles.LeftToolbar}>
                    <button type="button" title="Выбор (S)" className={`${styles.ToolBtn} ${tool === 'select' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('select')}>
                        <NearMeOutlinedIcon fontSize="small" />
                    </button>
                    <button type="button" title="Перемещение по холсту (H)" className={`${styles.ToolBtn} ${tool === 'pan' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('pan')}>
                        <PanToolOutlinedIcon fontSize="small" />
                    </button>

                    {canEdit ? (
                        <>
                            <button type="button" title="Ластик" className={`${styles.ToolBtn} ${tool === 'eraser' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('eraser')}>
                                <BackspaceOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title="Карандаш" className={`${styles.ToolBtn} ${tool === 'pencil' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('pencil')}>
                                <GestureOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title="Линия" className={`${styles.ToolBtn} ${tool === 'line' ? styles.ToolBtn_active : ''} ${leftPanel === 'line-config' ? styles.ToolBtn_panel : ''}`} onClick={() => { setTool('line'); togglePanel('line-config'); }}>
                                <TimelineOutlinedIcon fontSize="small" />
                            </button>

                            <div className={styles.ToolbarDivider} />

                            <button type="button" title="Фигуры" className={`${styles.ToolBtn} ${leftPanel === 'shapes' ? styles.ToolBtn_panel : ''}`} onClick={() => togglePanel('shapes')}>
                                <CategoryOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title="Текст и комментарии" className={`${styles.ToolBtn} ${leftPanel === 'text-panel' ? styles.ToolBtn_panel : ''}`} onClick={() => togglePanel('text-panel')}>
                                <TextFieldsOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title="Шаблоны" className={`${styles.ToolBtn} ${leftPanel === 'templates' || leftPanel === 'uml' ? styles.ToolBtn_panel : ''}`} onClick={() => togglePanel('templates')}>
                                <TableChartOutlinedIcon fontSize="small" />
                            </button>
                        </>
                    ) : null}

                    <div className={styles.ToolbarSpacer} />
                    <button type="button" className={styles.ZoomBtn} title="Уменьшить" onClick={() => clampZoom(zoom - ZOOM_STEP)}>−</button>
                    <button type="button" className={styles.ZoomLabel} title="Сбросить" onClick={() => { setZoom(1); setPanX(40); setPanY(40); }}>{Math.round(zoom * 100)}%</button>
                    <button type="button" className={styles.ZoomBtn} title="Увеличить" onClick={() => clampZoom(zoom + ZOOM_STEP)}>+</button>
                </nav>

                {/* ── LEFT PANELS ── */}
                {leftPanel === 'shapes' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Базовые элементы</Typography>
                        <input className={styles.PanelSearch} placeholder="Поиск фигур…" value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredShapes.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>
                                {tpl.name}
                            </button>
                        ))}
                        {filteredShapes.length === 0 ? <Typography variant="body2" color="text.secondary">Ничего не найдено</Typography> : null}
                    </div>
                ) : leftPanel === 'text-panel' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Текстовые блоки</Typography>
                        {TEXT_BLOCK_TEMPLATES.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>
                                {tpl.name}
                            </button>
                        ))}
                        <Typography variant="caption" color="text.secondary" style={{ marginTop: 4 }}>Двойной клик — редактировать</Typography>
                    </div>
                ) : leftPanel === 'templates' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Шаблоны</Typography>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('uml')}>
                            <TableChartOutlinedIcon fontSize="small" style={{ marginRight: 6 }} />UML
                        </button>
                    </div>
                ) : leftPanel === 'uml' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>← Шаблоны</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>UML-блоки</Typography>
                        <input className={styles.PanelSearch} placeholder="Поиск…" value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredUml.map((tpl) => (
                            <button key={tpl.type} type="button" className={styles.PaletteItem} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>
                                {tpl.name}
                            </button>
                        ))}
                        {filteredUml.length === 0 ? <Typography variant="body2" color="text.secondary">Ничего не найдено</Typography> : null}
                    </div>
                ) : leftPanel === 'line-config' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Линия</Typography>
                        <Select label="Стиль" value={lineStyle} onChange={(v) => setLineStyle(v as LineStyle)} options={lineStyleOpts} />
                        <Select label="Начало" value={lineStartEnding} onChange={(v) => setLineStartEnding(v as LineEnding)} options={endingOpts} />
                        <Select label="Конец" value={lineEndEnding} onChange={(v) => setLineEndEnding(v as LineEnding)} options={endingOpts} />
                    </div>
                ) : null}

                {/* ── CANVAS ── */}
                {canvasError ? <Alert severity="error" style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }}>{canvasError}</Alert> : null}

                <div
                    ref={canvasRef}
                    className={`${styles.Canvas} ${isDrawing ? styles.Canvas_drawing : ''} ${tool === 'eraser' ? styles.Canvas_eraser : ''} ${tool === 'pan' ? (isPanning ? styles.Canvas_grabbing : styles.Canvas_pan) : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    onPointerDown={onCanvasPointerDown}
                    onPointerMove={onCanvasPointerMove}
                    onPointerUp={onCanvasPointerUp}
                >
                    <div ref={canvasContentRef} className={styles.CanvasContent} style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
                        <svg className={styles.CanvasSvg} width="100000" height="100000">
                            <SvgDefs />
                            {elements.filter(isLine).map((line) => (
                                <line key={line.id} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                                    stroke="var(--text-color)" strokeWidth="2" strokeDasharray={dashArray(line.style)}
                                    markerEnd={mEnd(line.endEnding)} markerStart={mStart(line.startEnding)}
                                    style={{ cursor: tool === 'eraser' ? 'pointer' : 'default', pointerEvents: tool === 'eraser' ? 'stroke' : 'none' }}
                                    onClick={() => { if (tool === 'eraser') { pushHistory(); removeEl(line.id); } }}
                                />
                            ))}
                            {elements.filter(isPencil).map((p) => (
                                <path key={p.id} d={pointsToPath(p.points)}
                                    fill="none" stroke="var(--text-color)" strokeWidth="2"
                                    strokeLinecap="round" strokeLinejoin="round"
                                    style={{ cursor: tool === 'eraser' ? 'pointer' : 'default', pointerEvents: tool === 'eraser' ? 'stroke' : 'none' }}
                                    onClick={() => { if (tool === 'eraser') { pushHistory(); removeEl(p.id); } }}
                                />
                            ))}
                            {activeLineStart && activeLineCurrent ? (
                                <line x1={activeLineStart.x} y1={activeLineStart.y} x2={activeLineCurrent.x} y2={activeLineCurrent.y}
                                    stroke="var(--primary)" strokeWidth="2" strokeDasharray={dashArray(lineStyle)}
                                    markerEnd={mEnd(lineEndEnding)} markerStart={mStart(lineStartEnding)}
                                    opacity="0.7" style={{ pointerEvents: 'none' }}
                                />
                            ) : null}
                            {pencilPreview.length > 1 ? (
                                <path d={pointsToPath(pencilPreview)} fill="none" stroke="var(--primary)" strokeWidth="2"
                                    strokeLinecap="round" strokeLinejoin="round" opacity="0.7" style={{ pointerEvents: 'none' }}
                                />
                            ) : null}
                            {selBox ? (
                                <rect
                                    x={Math.min(selBox.x1, selBox.x2)} y={Math.min(selBox.y1, selBox.y2)}
                                    width={Math.abs(selBox.x2 - selBox.x1)} height={Math.abs(selBox.y2 - selBox.y1)}
                                    fill="color-mix(in srgb, var(--primary) 10%, transparent)"
                                    stroke="var(--primary)" strokeWidth="1" strokeDasharray="4,3"
                                    style={{ pointerEvents: 'none' }}
                                />
                            ) : null}
                        </svg>

                        {elements.filter(isBlock).map((block) => {
                            const isEditing = editing?.id === block.id;
                            const isShape = isShapeBlockType(block.type);
                            const isText = isTextBlock(block);
                            const isSelected = selectedIds.has(block.id);
                            return (
                                <div
                                    key={block.id}
                                    data-block="true"
                                    className={[
                                        styles.Block,
                                        styles[`Block_${block.type}`],
                                        isShape ? styles.Block_shape : '',
                                        isSelected && !isEditing ? styles.Block_selected : '',
                                    ].filter(Boolean).join(' ')}
                                    style={{ left: block.x, top: block.y, width: block.width, height: block.height, cursor: tool === 'eraser' ? 'pointer' : undefined }}
                                    onPointerDown={(e) => onBlockPointerDown(e, block)}
                                    onDoubleClick={() => startEditing(block)}
                                >
                                    {isEditing ? (
                                        isText ? (
                                            <textarea
                                                className={styles.TextBlockEdit}
                                                value={editing.title}
                                                autoFocus
                                                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                                onBlur={commitEdit}
                                                onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                                            />
                                        ) : (
                                            <div className={styles.BlockEditForm}>
                                                <input className={styles.BlockEditTitle} value={editing.title} autoFocus
                                                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setEditing(null); }}
                                                />
                                                {!isShape ? (
                                                    <textarea className={styles.BlockEditBody} value={editing.body}
                                                        onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                                                        onBlur={commitEdit}
                                                        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                                                    />
                                                ) : null}
                                            </div>
                                        )
                                    ) : isText ? (
                                        block.type === 'comment' ? (
                                            <div className={styles.CommentBlockContent}>
                                                <span className={styles.CommentIcon}>💬</span>
                                                <pre className={styles.CommentPre}>{block.title}</pre>
                                            </div>
                                        ) : (
                                            <div className={styles.TextBlockContent}>
                                                <pre className={styles.TextBlockPre}>{block.title}</pre>
                                            </div>
                                        )
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
                                            <div className={styles.BlockHeader} style={{ cursor: tool === 'eraser' ? 'pointer' : 'move' }}>{block.title}</div>
                                            <pre className={styles.BlockBody}>{block.body}</pre>
                                        </>
                                    )}
                                    {canEdit && tool === 'select' && !isEditing && !isText ? (
                                        <button type="button" aria-label="Resize block" className={styles.ResizeHandle} onPointerDown={(e) => onBlockResize(e, block)} />
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
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <Skeleton width={32} height={32} borderRadius={8} />
                    <Skeleton width={160} height={18} />
                </div>
                <div style={{ display: 'flex', flex: 1 }}>
                    <div style={{ width: 52, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width={36} height={36} borderRadius={10} />)}
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-soft)' }} />
                </div>
            </div>
        );
    }

    if (q.error || !q.data) {
        return (
            <div style={{ padding: 32 }}>
                <Alert severity="error">{q.error instanceof Error ? q.error.message : t.diagrams.saveContentError}</Alert>
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
