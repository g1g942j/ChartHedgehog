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
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import RedoOutlinedIcon from '@mui/icons-material/RedoOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import TextFieldsOutlinedIcon from '@mui/icons-material/TextFieldsOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
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
    type AnchorSide,
    BPMN_BLOCK_TEMPLATES,
    type DiagramBlockTemplate,
    type DiagramCanvasBlock,
    type DiagramEditorState,
    type DiagramElement,
    type DiagramLineElement,
    type DiagramPencilElement,
    ER_BLOCK_TEMPLATES,
    fetchDiagramEditorState,
    FLOWCHART_PRESETS,
    type FlowchartPreset,
    getAnchorPoint,
    isBpmnBlockType,
    isErBlockType,
    isMockupBlockType,
    isShapeBlockType,
    type LineEnding,
    type LineStyle,
    MOCKUP_BLOCK_TEMPLATES,
    resolveLineCoords,
    saveDiagramEditorState,
    SHAPE_BLOCK_TEMPLATES,
    TEXT_BLOCK_TEMPLATES,
    UML_BLOCK_TEMPLATES,
} from '../api/diagramEditor';
import { deleteDiagram, updateDiagramName } from '../api/diagrams';

// ─── types ────────────────────────────────────────────────────────────────────

type DrawingTool = 'select' | 'pan' | 'eraser' | 'pencil' | 'line';
type LeftPanel = 'none' | 'shapes' | 'uml' | 'bpmn' | 'er' | 'mockup' | 'flowchart' | 'line-config' | 'templates' | 'text-panel';
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
const GRID_SIZE = 20;
const ANCHOR_HIT_RADIUS = 14;

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

const ANCHOR_SIDES: AnchorSide[] = ['top', 'right', 'bottom', 'left'];

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
function snapV(v: number, snap: boolean): number {
    return snap ? Math.round(v / GRID_SIZE) * GRID_SIZE : v;
}

// ─── SVG defs ─────────────────────────────────────────────────────────────────

function SvgDefs({ snapToGrid }: { snapToGrid: boolean }) {
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
            {snapToGrid ? (
                <pattern id="grid-dots" x="0" y="0" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                    <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r="1" fill="var(--border)" />
                </pattern>
            ) : null}
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
    const [template, _setTemplate] = useState(initialEditorState.template ?? 'uml');
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

    useEffect(() => { elementsRef.current = elements; }, [elements]);

    // ── selection ─────────────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
    const [selBox, setSelBox] = useState<SelBox | null>(null);
    const selBoxStartRef = useRef<{ x: number; y: number } | null>(null);

    // ── clipboard ─────────────────────────────────────────────────────────────
    const clipboardRef = useRef<DiagramCanvasBlock[]>([]);

    // ── drawing state ─────────────────────────────────────────────────────────
    const [tool, setTool] = useState<DrawingTool>('select');
    const [snapToGrid, setSnapToGrid] = useState(false);
    const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
    const [lineStartEnding, setLineStartEnding] = useState<LineEnding>('none');
    const [lineEndEnding, setLineEndEnding] = useState<LineEnding>('arrow');
    const [activeLineStart, setActiveLineStart] = useState<{ x: number; y: number } | null>(null);
    const [activeLineCurrent, setActiveLineCurrent] = useState<{ x: number; y: number } | null>(null);
    const lineStartAnchorRef = useRef<{ blockId: string; side: AnchorSide } | null>(null);
    const activePencilRef = useRef<{ id: string; points: [number, number][] } | null>(null);
    const [pencilPreview, setPencilPreview] = useState<[number, number][]>([]);
    const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const touchRef = useRef<{ midX: number; midY: number; dist: number | null } | null>(null);

    // ── anchor hover ──────────────────────────────────────────────────────────
    const [anchorHover, setAnchorHover] = useState<{ blockId: string; side: AnchorSide } | null>(null);

    // ── UI panels ─────────────────────────────────────────────────────────────
    const [leftPanel, setLeftPanel] = useState<LeftPanel>('none');
    const [menuOpen, setMenuOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [transparentBg, setTransparentBg] = useState(false);
    const [shapeSearch, setShapeSearch] = useState('');
    const [showProps, setShowProps] = useState(false);

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

    // ── block map (for connector resolution) ─────────────────────────────────
    const blockMap = useMemo(() => {
        const m = new Map<string, DiagramCanvasBlock>();
        elements.filter(isBlock).forEach((b) => m.set(b.id, b));
        return m;
    }, [elements]);

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
        setSelectedLineId(null);
    }, []);

    const redo = useCallback(() => {
        const future = futureRef.current;
        if (!future.length) return;
        historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), elementsRef.current];
        futureRef.current = future.slice(1);
        setElements(future[0]!);
        setSelectedIds(new Set());
        setSelectedLineId(null);
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
            ...b, id: generateId(b.type), x: b.x + OFFSET, y: b.y + OFFSET,
        }));
        setElements((cur) => [...cur, ...newBlocks]);
        setSelectedIds(new Set(newBlocks.map((b) => b.id)));
    }, [canEdit, pushHistory]);

    const deleteSelected = useCallback(() => {
        if (!canEdit) return;
        if (selectedIds.size > 0) {
            pushHistory();
            setElements((cur) => cur.filter((el) => !selectedIds.has((el as { id?: string }).id ?? '')));
            setSelectedIds(new Set());
        } else if (selectedLineId) {
            pushHistory();
            setElements((cur) => cur.filter((el) => (el as { id?: string }).id !== selectedLineId));
            setSelectedLineId(null);
        }
    }, [canEdit, pushHistory, selectedIds, selectedLineId]);

    // ── keyboard shortcuts ────────────────────────────────────────────────────
    const keyActionsRef = useRef({ undo, redo, copySelected, paste, deleteSelected });
    useEffect(() => { keyActionsRef.current = { undo, redo, copySelected, paste, deleteSelected }; });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const a = keyActionsRef.current;
            if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); a.undo(); }
            else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); a.redo(); }
            else if (e.ctrlKey && e.key === 'c') { a.copySelected(); }
            else if (e.ctrlKey && e.key === 'v') { e.preventDefault(); a.paste(); }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey) { e.preventDefault(); a.deleteSelected(); }
            else if (e.key === 'Escape') { setSelectedIds(new Set()); setSelectedLineId(null); setEditing(null); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);  

    // ── save ──────────────────────────────────────────────────────────────────
    const saveNow = useCallback(async (els: DiagramElement[]) => {
        setSaveStatus('saving');
        try {
            await saveDiagramEditorState(diagramId, { template, blocks: els });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch { setSaveStatus('error'); }
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

    // ── touch pan + pinch-zoom ────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dist = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const mid = (a: Touch, b: Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                touchRef.current = { midX: e.touches[0].clientX, midY: e.touches[0].clientY, dist: null };
            } else if (e.touches.length === 2) {
                const m = mid(e.touches[0], e.touches[1]);
                touchRef.current = { midX: m.x, midY: m.y, dist: dist(e.touches[0], e.touches[1]) };
                e.preventDefault();
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!touchRef.current) return;
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();

            if (e.touches.length === 1 && touchRef.current.dist === null) {
                const dx = e.touches[0].clientX - touchRef.current.midX;
                const dy = e.touches[0].clientY - touchRef.current.midY;
                setPanX((px) => px + dx);
                setPanY((py) => py + dy);
                touchRef.current.midX = e.touches[0].clientX;
                touchRef.current.midY = e.touches[0].clientY;
            } else if (e.touches.length === 2 && touchRef.current.dist !== null) {
                const newDist = dist(e.touches[0], e.touches[1]);
                const m = mid(e.touches[0], e.touches[1]);
                const scale = newDist / touchRef.current.dist;
                const mx = m.x - rect.left;
                const my = m.y - rect.top;
                const dmx = m.x - touchRef.current.midX;
                const dmy = m.y - touchRef.current.midY;
                setZoom((z) => {
                    const nz = parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * scale)).toFixed(2));
                    setPanX((px) => mx - (mx - px) * (nz / z) + dmx);
                    setPanY((py) => my - (my - py) * (nz / z) + dmy);
                    return nz;
                });
                touchRef.current.dist = newDist;
                touchRef.current.midX = m.x;
                touchRef.current.midY = m.y;
            }
        };

        const onTouchEnd = () => { touchRef.current = null; };

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);
        canvas.addEventListener('touchcancel', onTouchEnd);
        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            canvas.removeEventListener('touchcancel', onTouchEnd);
        };
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
        return { x: (clientX - r.left - panX) / zoom, y: (clientY - r.top - panY) / zoom };
    };

    // ── nearest anchor detection ──────────────────────────────────────────────
    const findNearestAnchor = (pt: { x: number; y: number }): { blockId: string; side: AnchorSide } | null => {
        let best: { blockId: string; side: AnchorSide } | null = null;
        let bestDist = ANCHOR_HIT_RADIUS;
        for (const [id, block] of blockMap) {
            for (const side of ANCHOR_SIDES) {
                const ap = getAnchorPoint(block, side);
                const d = Math.hypot(pt.x - ap.x, pt.y - ap.y);
                if (d < bestDist) { bestDist = d; best = { blockId: id, side }; }
            }
        }
        return best;
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
            setSelectedIds(new Set()); setSelectedLineId(null); setEditing(null);
            const pt = getCanvasPoint(e.clientX, e.clientY);
            selBoxStartRef.current = pt;
            setSelBox({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
        }

        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);

        if (tool === 'line') {
            // check if clicking an anchor
            const nearAnchor = findNearestAnchor(pt);
            if (nearAnchor) {
                const block = blockMap.get(nearAnchor.blockId)!;
                const ap = getAnchorPoint(block, nearAnchor.side);
                lineStartAnchorRef.current = nearAnchor;
                setActiveLineStart(ap);
                setActiveLineCurrent(ap);
            } else {
                lineStartAnchorRef.current = null;
                setActiveLineStart(pt);
                setActiveLineCurrent(pt);
            }
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
            // snap to nearest anchor for preview
            const near = findNearestAnchor(pt);
            if (near) {
                const block = blockMap.get(near.blockId)!;
                const ap = getAnchorPoint(block, near.side);
                setActiveLineCurrent(ap);
                setAnchorHover(near);
            } else {
                setActiveLineCurrent(pt);
                setAnchorHover(null);
            }
        } else if (tool === 'pencil' && activePencilRef.current) {
            activePencilRef.current.points.push([pt.x, pt.y]);
            setPencilPreview([...activePencilRef.current.points]);
        }
    };

    const onCanvasPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (tool === 'pan') { panRef.current = null; setIsPanning(false); return; }
        if (tool === 'select') {
            if (selBox) {
                const minX = Math.min(selBox.x1, selBox.x2), maxX = Math.max(selBox.x1, selBox.x2);
                const minY = Math.min(selBox.y1, selBox.y2), maxY = Math.max(selBox.y1, selBox.y2);
                if (maxX - minX > 6 || maxY - minY > 6) {
                    const inBox = elements.filter(isBlock).filter(
                        (b) => b.x < maxX && b.x + b.width > minX && b.y < maxY && b.y + b.height > minY,
                    );
                    setSelectedIds(new Set(inBox.map((b) => b.id)));
                }
                setSelBox(null); selBoxStartRef.current = null;
            }
            return;
        }
        if (!canEdit) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);

        if (tool === 'line' && activeLineStart) {
            if (Math.hypot(pt.x - activeLineStart.x, pt.y - activeLineStart.y) > 8) {
                pushHistory();
                // find if endpoint is on an anchor
                const endAnchor = anchorHover ?? findNearestAnchor(pt);
                let x2 = pt.x, y2 = pt.y;
                if (endAnchor) { const b = blockMap.get(endAnchor.blockId)!; const ap = getAnchorPoint(b, endAnchor.side); x2 = ap.x; y2 = ap.y; }
                const line: DiagramLineElement = {
                    id: generateId('line'), kind: 'line',
                    x1: activeLineStart.x, y1: activeLineStart.y, x2, y2,
                    style: lineStyle, startEnding: lineStartEnding, endEnding: lineEndEnding,
                    ...(lineStartAnchorRef.current ? { fromBlockId: lineStartAnchorRef.current.blockId, fromAnchor: lineStartAnchorRef.current.side } : {}),
                    ...(endAnchor ? { toBlockId: endAnchor.blockId, toAnchor: endAnchor.side } : {}),
                };
                setElements((cur) => [...cur, line]);
            }
            setActiveLineStart(null); setActiveLineCurrent(null);
            lineStartAnchorRef.current = null; setAnchorHover(null);
        } else if (tool === 'pencil' && activePencilRef.current) {
            const { id, points } = activePencilRef.current;
            if (points.length > 2) {
                pushHistory();
                setElements((cur) => [...cur, { id, kind: 'pencil', points } as DiagramPencilElement]);
            }
            activePencilRef.current = null; setPencilPreview([]);
        }
    };

    // ── element helpers ───────────────────────────────────────────────────────
    const updateEl = (id: string, patch: Partial<DiagramCanvasBlock>) =>
        setElements((cur) => cur.map((el) => (isBlock(el) && el.id === id ? { ...el, ...patch } : el)));

    const updateLine = (id: string, patch: Partial<DiagramLineElement>) =>
        setElements((cur) => cur.map((el) => (isLine(el) && el.id === id ? { ...el, ...patch } : el)));

    const removeEl = (id: string) => setElements((cur) => cur.filter((el) => (el as { id?: string }).id !== id));

    const createBlock = (tpl: DiagramBlockTemplate, id: string, x = 100, y = 100): DiagramCanvasBlock => ({
        id, type: tpl.type, title: tpl.title, body: tpl.body, x, y, width: tpl.width, height: tpl.height,
    });

    const addBlock = (tpl: DiagramBlockTemplate) => {
        pushHistory();
        const id = generateId(tpl.type);
        setElements((cur) => [...cur, createBlock(tpl, id, 100 + cur.filter(isBlock).length * 20, 100)]);
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
        const tpl = [...UML_BLOCK_TEMPLATES, ...SHAPE_BLOCK_TEMPLATES, ...TEXT_BLOCK_TEMPLATES, ...BPMN_BLOCK_TEMPLATES, ...ER_BLOCK_TEMPLATES, ...MOCKUP_BLOCK_TEMPLATES].find((t) => t.type === blockType);
        if (!tpl) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);
        const id = generateId(tpl.type);
        pushHistory();
        setElements((cur) => [...cur, createBlock(tpl, id, pt.x - 40, pt.y - 24)]);
    };

    // ── block pointer events ──────────────────────────────────────────────────
    const onBlockPointerDown = (e: ReactPointerEvent<HTMLDivElement>, block: DiagramCanvasBlock) => {
        if (tool === 'pan') return;
        if (tool === 'eraser') { pushHistory(); removeEl(block.id); return; }
        if (!canEdit || editing?.id === block.id) return;
        if (tool === 'line') return; // handled via anchor dots

        const moveIds: Set<string> = selectedIds.has(block.id) ? new Set(selectedIds) : new Set([block.id]);
        if (e.shiftKey) {
            setSelectedIds((prev) => { const n = new Set(prev); if (n.has(block.id)) { n.delete(block.id); } else { n.add(block.id); } return n; });
            return;
        }
        if (!selectedIds.has(block.id)) setSelectedIds(moveIds);
        setSelectedLineId(null);

        e.currentTarget.setPointerCapture(e.pointerId);
        const startPositions = new Map<string, { x: number; y: number }>(
            elementsRef.current.filter(isBlock).filter((b) => moveIds.has(b.id)).map((b) => [b.id, { x: b.x, y: b.y }]),
        );
        const sx = e.clientX, sy = e.clientY;
        dragSnapshotRef.current = [...elementsRef.current];
        let moved = false;
        const currentZoom = zoom;

        const move = (me: PointerEvent) => {
            moved = true;
            const dx = snapV((me.clientX - sx) / currentZoom, snapToGrid);
            const dy = snapV((me.clientY - sy) / currentZoom, snapToGrid);
            setElements((cur) => cur.map((el) => {
                if (!isBlock(el) || !moveIds.has(el.id)) return el;
                const start = startPositions.get(el.id);
                if (!start) return el;
                return { ...el, x: snapV(start.x + dx, snapToGrid), y: snapV(start.y + dy, snapToGrid) };
            }));
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
            width: Math.max(80, snapV(sw + (me.clientX - sx) / currentZoom, snapToGrid)),
            height: Math.max(60, snapV(sh + (me.clientY - sy) / currentZoom, snapToGrid)),
        });
        const up = () => {
            if (dragSnapshotRef.current) { historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), dragSnapshotRef.current]; futureRef.current = []; dragSnapshotRef.current = null; }
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // ── selected element for properties ──────────────────────────────────────
    const selectedBlock = useMemo(() => {
        if (selectedIds.size !== 1) return null;
        const [id] = selectedIds;
        return blockMap.get(id!) ?? null;
    }, [selectedIds, blockMap]);

    const selectedLine = useMemo(() => {
        if (!selectedLineId) return null;
        return elements.find((el) => isLine(el) && el.id === selectedLineId) as DiagramLineElement | undefined ?? null;
    }, [selectedLineId, elements]);

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
            else if (isLine(el)) { const c = resolveLineCoords(el, blockMap); minX = Math.min(minX, c.x1, c.x2); minY = Math.min(minY, c.y1, c.y2); maxX = Math.max(maxX, c.x1, c.x2); maxY = Math.max(maxY, c.y1, c.y2); }
            else if (isPencil(el)) { for (const [px, py] of el.points) { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); } }
        }
        if (!isFinite(minX)) return null;
        return { x: Math.max(0, minX - PAD), y: Math.max(0, minY - PAD), width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 };
    };

    const buildSvg = (transparent = false): string => {
        const PAD = 24;
        const bounds = getContentBounds();
        const vx = bounds?.x ?? 0, vy = bounds?.y ?? 0;
        const vw = bounds?.width ?? 800, vh = bounds?.height ?? 600;
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const defs = `<defs><marker id="e-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#000"/></marker><marker id="e-open" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polyline points="0,1 9,4 0,7" fill="none" stroke="#000" stroke-width="1.5"/></marker><marker id="e-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="3" fill="#000"/></marker><marker id="s-arrow" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse"><polygon points="0 0,10 3.5,0 7" fill="#000"/></marker><marker id="s-open" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse"><polyline points="0,1 9,4 0,7" fill="none" stroke="#000" stroke-width="1.5"/></marker><marker id="s-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><circle cx="4" cy="4" r="3" fill="#000"/></marker></defs>`;
        const em = (e: LineEnding, p: string) => e === 'arrow' ? `url(#${p}-arrow)` : e === 'open-arrow' ? `url(#${p}-open)` : e === 'circle-end' ? `url(#${p}-circle)` : '';
        const sd = (s: LineStyle) => s === 'dashed' ? 'stroke-dasharray="10,5"' : s === 'dotted' ? 'stroke-dasharray="3,5"' : '';
        const svgLines = elements.filter(isLine).map((l) => {
            const c = resolveLineCoords(l, blockMap);
            const stroke = esc(l.strokeColor ?? '#000');
            const sw = l.strokeWidth ?? 2;
            return `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="${stroke}" stroke-width="${sw}" ${sd(l.style)} ${em(l.endEnding,'e') ? `marker-end="${em(l.endEnding,'e')}"`:''} ${em(l.startEnding,'s') ? `marker-start="${em(l.startEnding,'s')}"`:''} />`;
        }).join('\n');
        const svgPencil = elements.filter(isPencil).map((p) => `<path d="${pointsToPath(p.points)}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n');
        const svgBlocks = elements.filter(isBlock).map((b) => {
            const x = b.x, y = b.y, w = b.width, h = b.height;
            const sc = esc(b.strokeColor ?? '#1a56db'), fc = b.fillColor ? esc(b.fillColor) : undefined;
            if (b.type === 'text') return `<text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" dominant-baseline="middle" font-size="${b.fontSize??14}" fill="${sc}">${esc(b.title)}</text>`;
            if (b.type === 'comment') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fc??'#fefce8'}" stroke="#eab308" stroke-width="1.5" rx="8"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#78350f">${esc(b.title)}</text>`;
            if (b.type === 'bpmn-task') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fc??'#eff6ff'}" stroke="${sc??'#3b82f6'}" stroke-width="2" rx="12"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#1e3a8a">${esc(b.title)}</text>`;
            if (b.type === 'bpmn-event') return `<circle cx="${x+w/2}" cy="${y+h/2}" r="${Math.min(w,h)/2-2}" fill="${fc??'#fff'}" stroke="${sc??'#22c55e'}" stroke-width="2"/>`;
            if (b.type === 'bpmn-end') return `<circle cx="${x+w/2}" cy="${y+h/2}" r="${Math.min(w,h)/2-2}" fill="${fc??'#fff'}" stroke="${sc??'#ef4444'}" stroke-width="4"/>`;
            if (b.type === 'bpmn-gateway') return `<polygon points="${x+w/2},${y+2} ${x+w-2},${y+h/2} ${x+w/2},${y+h-2} ${x+2},${y+h/2}" fill="${fc??'#fef9c3'}" stroke="${sc??'#eab308'}" stroke-width="2"/>`;
            if (b.type === 'er-entity') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fc??'#fff'}" stroke="${sc??'#1a56db'}" stroke-width="2"/><rect x="${x}" y="${y}" width="${w}" height="28" fill="${sc??'#1a56db'}"/><text x="${x+w/2}" y="${y+14}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#fff">${esc(b.title)}</text><text x="${x+8}" y="${y+42}" font-size="11" fill="#000" font-family="Consolas,monospace">${esc(b.body)}</text>`;
            if (b.type === 'er-attribute') return `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2-2}" ry="${h/2-2}" fill="${fc??'#fff'}" stroke="${sc??'#1a56db'}" stroke-width="1.5"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#000">${esc(b.title)}</text>`;
            if (b.type === 'er-relation') return `<polygon points="${x+w/2},${y+2} ${x+w-2},${y+h/2} ${x+w/2},${y+h-2} ${x+2},${y+h/2}" fill="${fc??'#fff'}" stroke="${sc??'#7c3aed'}" stroke-width="2"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#000">${esc(b.title)}</text>`;
            if (isShapeBlockType(b.type)) {
                const shapeColors: Record<string, string> = { rectangle: '#3b82f6', circle: '#ec4899', diamond: '#f59e0b', triangle: '#22c55e', sticky: '#eab308' };
                const color = sc ?? shapeColors[b.type] ?? '#3b82f6';
                let shapeEl = '';
                if (b.type === 'rectangle') shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fc??'rgba(59,130,246,0.07)'}" stroke="${color}" stroke-width="2.5" rx="6"/>`;
                else if (b.type === 'circle') shapeEl = `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${fc??'rgba(236,72,153,0.07)'}" stroke="${color}" stroke-width="2.5"/>`;
                else if (b.type === 'diamond') shapeEl = `<polygon points="${x+w/2},${y+PAD/2} ${x+w-PAD/2},${y+h/2} ${x+w/2},${y+h-PAD/2} ${x+PAD/2},${y+h/2}" fill="${fc??'none'}" stroke="${color}" stroke-width="2.5"/>`;
                else if (b.type === 'triangle') shapeEl = `<polygon points="${x+w/2},${y+PAD/2} ${x+w-PAD/2},${y+h-PAD/2} ${x+PAD/2},${y+h-PAD/2}" fill="${fc??'none'}" stroke="${color}" stroke-width="2.5"/>`;
                else if (b.type === 'sticky') shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fc??'#fef9c3'}" stroke="${color}" stroke-width="2" rx="4"/>`;
                return `${shapeEl}\n<text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" dominant-baseline="middle" font-size="${b.fontSize??13}" font-weight="600" fill="${color}">${esc(b.title)}</text>`;
            }
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fc??'#fff'}" stroke="${sc??'#1a56db'}" stroke-width="2" rx="10"/>
<rect x="${x}" y="${y}" width="${w}" height="32" fill="${sc??'#1a56db'}" rx="10"/>
<rect x="${x}" y="${y+22}" width="${w}" height="10" fill="${sc??'#1a56db'}"/>
<text x="${x+w/2}" y="${y+16}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#fff">${esc(b.title)}</text>
<text x="${x+10}" y="${y+48}" font-size="12" fill="#000" font-family="Consolas,monospace">${esc(b.body)}</text>`;
        }).join('\n');
        const bgRect = transparent ? '' : `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">\n${defs}\n${bgRect}\n${svgLines}\n${svgPencil}\n${svgBlocks}\n</svg>`;
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
            onclone: (doc) => {
                const vars: Record<string, string> = { '--text-color': '#000000', '--primary': '#1a56db', '--primary-contrast': '#ffffff', '--surface': '#ffffff', '--bg-soft': '#f8f8f8', '--border': '#d0d0d0', '--text-secondary': '#555555' };
                Object.entries(vars).forEach(([k, v]) => doc.documentElement.style.setProperty(k, v));
            },
            ...(bounds ?? {}),
        });
        setZoom(savedZoom); setPanX(savedPanX); setPanY(savedPanY);
        return canvas;
    };

    const handleExport = async (format: ExportFormat) => {
        setIsExporting(true);
        try {
            const fname = renaming || diagramName || 'diagram';
            if (format === 'json') { downloadBlob(new Blob([JSON.stringify(elements, null, 2)], { type: 'application/json' }), `${fname}.json`); setExportOpen(false); return; }
            if (format === 'svg') { downloadBlob(new Blob([buildSvg(transparentBg)], { type: 'image/svg+xml' }), `${fname}.svg`); setExportOpen(false); return; }
            const canvas = await captureCanvas(transparentBg);
            if (format === 'png') canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${fname}.png`); }, 'image/png');
            else if (format === 'jpeg') canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${fname}.jpeg`); }, 'image/jpeg', 0.92);
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
    const togglePanel = (panel: LeftPanel) => setLeftPanel((cur) => (cur === panel ? 'none' : panel));
    const selectTool = (tl: DrawingTool) => { setTool(tl); if (tl !== 'select' && tl !== 'pan') setLeftPanel('none'); };

    // ── options ───────────────────────────────────────────────────────────────
    const lineStyleOpts = useMemo<SelectOption[]>(() => LINE_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label })), []);
    const endingOpts = useMemo<SelectOption[]>(() => ENDING_OPTIONS.map((o) => ({ value: o.value, label: o.label })), []);
    const isDrawing = tool === 'line' || tool === 'pencil';

    const filteredShapes = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? SHAPE_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q)) : SHAPE_BLOCK_TEMPLATES; }, [shapeSearch]);
    const filteredUml = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? UML_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q)) : UML_BLOCK_TEMPLATES; }, [shapeSearch]);
    const filteredBpmn = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? BPMN_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q)) : BPMN_BLOCK_TEMPLATES; }, [shapeSearch]);
    const filteredEr = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? ER_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q)) : ER_BLOCK_TEMPLATES; }, [shapeSearch]);
    const filteredMockup = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? MOCKUP_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q)) : MOCKUP_BLOCK_TEMPLATES; }, [shapeSearch]);

    const addPreset = (preset: FlowchartPreset) => {
        const canvas = canvasRef.current;
        const rect = canvas?.getBoundingClientRect();
        const cx = rect ? (rect.width / 2 - panX) / zoom : 100;
        const cy = rect ? (rect.height / 2 - panY) / zoom : 100;
        pushHistory();
        setElements((cur) => [...cur, ...preset.generate(Math.round(cx - 70), Math.round(cy - 60))]);
        setLeftPanel('none');
    };

    // ── minimap ───────────────────────────────────────────────────────────────
    const minimapBounds = useMemo(() => getContentBounds(), [elements]); // eslint-disable-line react-hooks/exhaustive-deps
    const MINI_W = 160, MINI_H = 90;

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
                            <button type="button" className={styles.TopBarBtn} title="Отменить (Ctrl+Z)" onClick={undo}><UndoOutlinedIcon fontSize="small" /></button>
                            <button type="button" className={styles.TopBarBtn} title="Повторить (Ctrl+Y)" onClick={redo}><RedoOutlinedIcon fontSize="small" /></button>
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
                            <Typography variant="caption" style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary, #888)' }}>Доступ</Typography>
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
                            <button type="button" title="Шаблоны" className={`${styles.ToolBtn} ${['templates','uml','bpmn','er','mockup','flowchart'].includes(leftPanel) ? styles.ToolBtn_panel : ''}`} onClick={() => togglePanel('templates')}>
                                <TableChartOutlinedIcon fontSize="small" />
                            </button>
                            <div className={styles.ToolbarDivider} />
                            <button type="button" title={snapToGrid ? 'Сетка вкл.' : 'Сетка выкл.'} className={`${styles.ToolBtn} ${snapToGrid ? styles.ToolBtn_active : ''}`} onClick={() => setSnapToGrid((v) => !v)}>
                                <GridOnOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title="Свойства" className={`${styles.ToolBtn} ${showProps ? styles.ToolBtn_active : ''}`} onClick={() => setShowProps((v) => !v)}>
                                <TuneOutlinedIcon fontSize="small" />
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
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredShapes.length === 0 ? <Typography variant="body2" color="text.secondary">Ничего не найдено</Typography> : null}
                    </div>
                ) : leftPanel === 'text-panel' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Текстовые блоки</Typography>
                        {TEXT_BLOCK_TEMPLATES.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        <Typography variant="caption" color="text.secondary" style={{ marginTop: 4 }}>Двойной клик — редактировать</Typography>
                    </div>
                ) : leftPanel === 'templates' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Библиотеки</Typography>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('uml')}><TableChartOutlinedIcon fontSize="small" style={{ marginRight: 6 }} />UML</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('bpmn')}>BPMN</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('er')}>ER-диаграмма</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('mockup')}>Mockup / UI</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('flowchart')}>Пресеты</button>
                    </div>
                ) : leftPanel === 'uml' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>← Библиотеки</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>UML-блоки</Typography>
                        <input className={styles.PanelSearch} placeholder="Поиск…" value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredUml.map((tpl) => (
                            <button key={tpl.type} type="button" className={styles.PaletteItem} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredUml.length === 0 ? <Typography variant="body2" color="text.secondary">Ничего не найдено</Typography> : null}
                    </div>
                ) : leftPanel === 'bpmn' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>← Библиотеки</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>BPMN</Typography>
                        <input className={styles.PanelSearch} placeholder="Поиск…" value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredBpmn.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredBpmn.length === 0 ? <Typography variant="body2" color="text.secondary">Ничего не найдено</Typography> : null}
                    </div>
                ) : leftPanel === 'er' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>← Библиотеки</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>ER-диаграмма</Typography>
                        <input className={styles.PanelSearch} placeholder="Поиск…" value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredEr.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredEr.length === 0 ? <Typography variant="body2" color="text.secondary">Ничего не найдено</Typography> : null}
                    </div>
                ) : leftPanel === 'mockup' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>← Библиотеки</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Mockup / UI</Typography>
                        <input className={styles.PanelSearch} placeholder="Поиск…" value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredMockup.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredMockup.length === 0 ? <Typography variant="body2" color="text.secondary">Ничего не найдено</Typography> : null}
                    </div>
                ) : leftPanel === 'flowchart' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>← Библиотеки</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Пресеты</Typography>
                        <Typography variant="caption" color="text.secondary" style={{ marginBottom: 8, display: 'block' }}>Нажмите — вставит набор блоков в центр холста</Typography>
                        {FLOWCHART_PRESETS.map((preset) => (
                            <button key={preset.name} type="button" className={styles.PresetItem} onClick={() => addPreset(preset)}>
                                <span className={styles.PresetName}>{preset.name}</span>
                                <span className={styles.PresetDesc}>{preset.description}</span>
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
                    onClick={() => { setSelectedIds(new Set()); setSelectedLineId(null); }}
                >
                    <div ref={canvasContentRef} className={styles.CanvasContent} style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
                        <svg className={styles.CanvasSvg} width="100000" height="100000">
                            <SvgDefs snapToGrid={snapToGrid} />
                            {snapToGrid ? <rect width="100000" height="100000" fill="url(#grid-dots)" style={{ pointerEvents: 'none' }} /> : null}

                            {elements.filter(isLine).map((line) => {
                                const c = resolveLineCoords(line, blockMap);
                                const isSelLine = selectedLineId === line.id;
                                return (
                                    <g key={line.id}>
                                        {/* invisible wider hit area */}
                                        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                                            stroke="transparent" strokeWidth="12"
                                            style={{ cursor: tool === 'select' ? 'pointer' : tool === 'eraser' ? 'pointer' : 'default', pointerEvents: 'stroke' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (tool === 'eraser') { pushHistory(); removeEl(line.id); }
                                                else if (tool === 'select') { setSelectedLineId(line.id); setSelectedIds(new Set()); }
                                            }}
                                        />
                                        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                                            stroke={line.strokeColor ?? 'var(--text-color)'}
                                            strokeWidth={isSelLine ? (line.strokeWidth ?? 2) + 1 : (line.strokeWidth ?? 2)}
                                            strokeDasharray={dashArray(line.style)}
                                            markerEnd={mEnd(line.endEnding)} markerStart={mStart(line.startEnding)}
                                            style={{ pointerEvents: 'none', ...(isSelLine ? { filter: 'drop-shadow(0 0 3px var(--primary))' } : {}) }}
                                        />
                                    </g>
                                );
                            })}

                            {elements.filter(isPencil).map((p) => (
                                <path key={p.id} d={pointsToPath(p.points)} fill="none" stroke="var(--text-color)" strokeWidth="2"
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
                            const isBpmn = isBpmnBlockType(block.type);
                            const isEr = isErBlockType(block.type);
                            const isMockup = isMockupBlockType(block.type);
                            const isText = isTextBlock(block);
                            const isSelected = selectedIds.has(block.id);
                            const showAnchors = tool === 'line' && !isEditing;

                            return (
                                <div
                                    key={block.id}
                                    data-block="true"
                                    className={[
                                        styles.Block,
                                        styles[`Block_${block.type}`],
                                        isShape ? styles.Block_shape : '',
                                        isBpmn ? styles.Block_bpmn : '',
                                        isEr ? styles.Block_er : '',
                                        isMockup ? styles.Block_mockup : '',
                                        isSelected && !isEditing ? styles.Block_selected : '',
                                    ].filter(Boolean).join(' ')}
                                    style={{
                                        left: block.x, top: block.y, width: block.width, height: block.height,
                                        cursor: tool === 'eraser' ? 'pointer' : undefined,
                                        ...(block.fillColor ? { '--block-fill': block.fillColor } as React.CSSProperties : {}),
                                        ...(block.strokeColor ? { '--block-stroke': block.strokeColor } as React.CSSProperties : {}),
                                        ...(block.strokeWidth ? { '--block-stroke-width': `${block.strokeWidth}px` } as React.CSSProperties : {}),
                                        ...(block.fontSize ? { '--block-font-size': `${block.fontSize}px` } as React.CSSProperties : {}),
                                    }}
                                    onPointerDown={(e) => onBlockPointerDown(e, block)}
                                    onDoubleClick={() => startEditing(block)}
                                    onPointerEnter={() => { if (tool === 'line') setAnchorHover(null); }}
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
                                                {!isShape && !isBpmn && !isEr && !isMockup ? (
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
                                    ) : isBpmn ? (
                                        <BpmnBlockContent block={block} />
                                    ) : isEr ? (
                                        <ErBlockContent block={block} />
                                    ) : isMockup ? (
                                        <MockupBlockContent block={block} />
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

                                    {/* anchor dots shown in line-draw mode */}
                                    {showAnchors ? ANCHOR_SIDES.map((side) => {
                                        const isHot = anchorHover?.blockId === block.id && anchorHover.side === side;
                                        return (
                                            <div
                                                key={side}
                                                className={`${styles.AnchorDot} ${styles[`AnchorDot_${side}`]} ${isHot ? styles.AnchorDot_hot : ''}`}
                                                onPointerDown={(e) => {
                                                    e.stopPropagation();
                                                    const ap = getAnchorPoint(block, side);
                                                    lineStartAnchorRef.current = { blockId: block.id, side };
                                                    setActiveLineStart(ap);
                                                    setActiveLineCurrent(ap);
                                                    (canvasRef.current as HTMLDivElement | null)?.setPointerCapture(e.pointerId);
                                                }}
                                                onPointerEnter={() => setAnchorHover({ blockId: block.id, side })}
                                                onPointerLeave={() => setAnchorHover(null)}
                                            />
                                        );
                                    }) : null}

                                    {canEdit && tool === 'select' && !isEditing && !isText ? (
                                        <button type="button" aria-label="Resize block" className={styles.ResizeHandle} onPointerDown={(e) => onBlockResize(e, block)} />
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── MINIMAP ── */}
                    {minimapBounds && elements.length > 0 ? (
                        <div className={styles.Minimap} title="Миникарта">
                            <svg width={MINI_W} height={MINI_H}
                                viewBox={`${minimapBounds.x} ${minimapBounds.y} ${minimapBounds.width} ${minimapBounds.height}`}
                                style={{ width: MINI_W, height: MINI_H }}
                            >
                                {elements.filter(isLine).map((l) => {
                                    const c = resolveLineCoords(l, blockMap);
                                    return <line key={l.id} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="var(--text-color)" strokeWidth="3" opacity="0.5" />;
                                })}
                                {elements.filter(isBlock).map((b) => (
                                    <rect key={b.id} x={b.x} y={b.y} width={b.width} height={b.height}
                                        fill={b.fillColor ?? (isShapeBlockType(b.type) ? 'var(--primary)' : 'var(--surface)')}
                                        stroke={b.strokeColor ?? 'var(--primary)'} strokeWidth="3" rx="4" opacity="0.8"
                                    />
                                ))}
                            </svg>
                        </div>
                    ) : null}
                </div>

                {/* ── PROPERTIES PANEL ── */}
                {showProps ? (
                    <div className={styles.PropertiesPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>Свойства</Typography>
                        {selectedBlock ? (
                            <>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>Заливка</label>
                                    <input type="color" className={styles.ColorInput}
                                        value={selectedBlock.fillColor ?? '#ffffff'}
                                        onChange={(e) => { pushHistory(); updateEl(selectedBlock.id, { fillColor: e.target.value }); }}
                                    />
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>Цвет рамки</label>
                                    <input type="color" className={styles.ColorInput}
                                        value={selectedBlock.strokeColor ?? '#1a56db'}
                                        onChange={(e) => { pushHistory(); updateEl(selectedBlock.id, { strokeColor: e.target.value }); }}
                                    />
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>Толщина рамки</label>
                                    <input type="range" min="1" max="6" step="1"
                                        value={selectedBlock.strokeWidth ?? 2}
                                        onChange={(e) => updateEl(selectedBlock.id, { strokeWidth: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedBlock.strokeWidth ?? 2}px</span>
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>Размер текста</label>
                                    <input type="range" min="10" max="24" step="1"
                                        value={selectedBlock.fontSize ?? 13}
                                        onChange={(e) => updateEl(selectedBlock.id, { fontSize: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedBlock.fontSize ?? 13}px</span>
                                </div>
                            </>
                        ) : selectedLine ? (
                            <>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>Цвет линии</label>
                                    <input type="color" className={styles.ColorInput}
                                        value={selectedLine.strokeColor ?? '#000000'}
                                        onChange={(e) => { pushHistory(); updateLine(selectedLine.id, { strokeColor: e.target.value }); }}
                                    />
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>Толщина</label>
                                    <input type="range" min="1" max="8" step="1"
                                        value={selectedLine.strokeWidth ?? 2}
                                        onChange={(e) => updateLine(selectedLine.id, { strokeWidth: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedLine.strokeWidth ?? 2}px</span>
                                </div>
                                <Select label="Стиль" value={selectedLine.style} onChange={(v) => { pushHistory(); updateLine(selectedLine.id, { style: v as LineStyle }); }} options={lineStyleOpts} />
                                <Select label="Конец" value={selectedLine.endEnding} onChange={(v) => { pushHistory(); updateLine(selectedLine.id, { endEnding: v as LineEnding }); }} options={endingOpts} />
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary" style={{ marginTop: 8 }}>
                                Выберите блок или линию
                            </Typography>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// ─── BPMN block renderer ──────────────────────────────────────────────────────

function BpmnBlockContent({ block }: { block: DiagramCanvasBlock }) {
    const w = block.width, h = block.height;
    if (block.type === 'bpmn-event') {
        return (
            <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={styles.BpmnSvg}>
                <circle cx={w/2} cy={h/2} r={Math.min(w,h)/2-3} fill="var(--block-fill,#fff)" stroke="var(--block-stroke,#22c55e)" strokeWidth="var(--block-stroke-width,2)" />
            </svg>
        );
    }
    if (block.type === 'bpmn-end') {
        return (
            <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={styles.BpmnSvg}>
                <circle cx={w/2} cy={h/2} r={Math.min(w,h)/2-3} fill="var(--block-fill,#fff)" stroke="var(--block-stroke,#ef4444)" strokeWidth="var(--block-stroke-width,4)" />
            </svg>
        );
    }
    if (block.type === 'bpmn-gateway') {
        return (
            <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={styles.BpmnSvg}>
                <polygon points={`${w/2},2 ${w-2},${h/2} ${w/2},${h-2} 2,${h/2}`} fill="var(--block-fill,#fef9c3)" stroke="var(--block-stroke,#eab308)" strokeWidth="var(--block-stroke-width,2)" />
                {block.title ? <text x={w/2} y={h/2} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--block-stroke,#eab308)">{block.title}</text> : null}
            </svg>
        );
    }
    // bpmn-task
    return (
        <div className={styles.BpmnTask}>
            <span className={styles.BpmnTaskLabel}>{block.title}</span>
        </div>
    );
}

// ─── ER block renderer ────────────────────────────────────────────────────────

function ErBlockContent({ block }: { block: DiagramCanvasBlock }) {
    const w = block.width, h = block.height;
    if (block.type === 'er-attribute') {
        return (
            <div className={styles.ErAttribute}>
                <span>{block.title}</span>
            </div>
        );
    }
    if (block.type === 'er-relation') {
        return (
            <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={styles.BpmnSvg}>
                <polygon points={`${w/2},2 ${w-2},${h/2} ${w/2},${h-2} 2,${h/2}`} fill="var(--block-fill,#f3e8ff)" stroke="var(--block-stroke,#7c3aed)" strokeWidth="var(--block-stroke-width,2)" />
                <text x={w/2} y={h/2} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="var(--block-stroke,#7c3aed)">{block.title}</text>
            </svg>
        );
    }
    // er-entity
    return (
        <div className={styles.ErEntity}>
            <div className={styles.ErEntityHeader}>{block.title}</div>
            <pre className={styles.ErEntityBody}>{block.body}</pre>
        </div>
    );
}

function MockupBlockContent({ block }: { block: DiagramCanvasBlock }) {
    if (block.type === 'mockup-button') {
        return (
            <div className={styles.MockupButton}>{block.title || 'Кнопка'}</div>
        );
    }
    if (block.type === 'mockup-input') {
        return (
            <div className={styles.MockupInput}>{block.title || 'Placeholder…'}</div>
        );
    }
    if (block.type === 'mockup-checkbox') {
        return (
            <div className={styles.MockupCheckbox}>
                <span className={styles.MockupCheckboxBox} />
                <span>{block.title || 'Чекбокс'}</span>
            </div>
        );
    }
    // mockup-card
    return (
        <div className={styles.MockupCard}>
            <div className={styles.MockupCardHeader}>{block.title || 'Card'}</div>
            <div className={styles.MockupCardBody}>{block.body || 'Content area'}</div>
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
            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
                <Alert severity="error">{q.error instanceof Error ? q.error.message : t.diagrams.saveContentError}</Alert>
                <Link href="/diagrams" style={{ fontSize: 14 }}>← {t.common.backToList}</Link>
            </div>
        );
    }

    return (
        <DiagramEditorPage
            key={`${diagramId}:${q.data.template ?? ''}`}
            diagramId={diagramId}
            diagramName={diagramName}
            currentUserRole={currentUserRole}
            initialEditorState={q.data}
        />
    );
}
