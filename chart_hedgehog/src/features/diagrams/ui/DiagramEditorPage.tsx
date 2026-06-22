'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useQueryClient } from '@tanstack/react-query';
import AlignHorizontalCenterOutlinedIcon from '@mui/icons-material/AlignHorizontalCenterOutlined';
import AlignHorizontalLeftOutlinedIcon from '@mui/icons-material/AlignHorizontalLeftOutlined';
import AlignHorizontalRightOutlinedIcon from '@mui/icons-material/AlignHorizontalRightOutlined';
import AlignVerticalBottomOutlinedIcon from '@mui/icons-material/AlignVerticalBottomOutlined';
import AlignVerticalCenterOutlinedIcon from '@mui/icons-material/AlignVerticalCenterOutlined';
import AlignVerticalTopOutlinedIcon from '@mui/icons-material/AlignVerticalTopOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import GestureOutlinedIcon from '@mui/icons-material/GestureOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
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

import { apiFetch } from '@/shared/api/client';
import { getSessionUser } from '@/shared/auth/session';
import { useLocale } from '@/shared/i18n';
import { LanguageSwitcher } from '@/widgets/LanguageSwitcher';
import { useThemeMode } from '@/shared/theme';
import { useToast } from '@/shared/toast';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
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
import { type CollabBatchOp, useCollaboration } from '../model/useCollaboration';
import { CollaborationAvatars } from './CollaborationAvatars';
import { RemoteCursors } from './RemoteCursors';

// ─── EraserIcon ───────────────────────────────────────────────────────────────

function EraserIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.14 3a2 2 0 0 0-1.41.59L2.59 14.73a2 2 0 0 0 0 2.83L5.04 20H20v-2h-8.59l7.02-7.02a2 2 0 0 0 0-2.83l-3.88-3.88A2 2 0 0 0 15.14 3zm0 2 3.88 3.88L12 15.9 8.12 12 15.14 5zM6.7 13.41l3.88 3.88-1.58 1.58-1.42.13H5.04l-2.45-2.44 4.11-3.15z"/>
        </svg>
    );
}

// ─── types ────────────────────────────────────────────────────────────────────

type DrawingTool = 'select' | 'pan' | 'eraser' | 'pencil' | 'line';
type LeftPanel = 'none' | 'shapes' | 'uml' | 'bpmn' | 'er' | 'mockup' | 'flowchart' | 'line-config' | 'templates';
type BlockGroup = { id: string; blockIds: string[] };
type EditingBlock = { id: string; title: string; body: string };
type ExportFormat = 'json' | 'svg' | 'png' | 'jpeg' | 'pdf';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SelBox = { x1: number; y1: number; x2: number; y2: number };

function generateId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const HISTORY_LIMIT = 50;
const GRID_SIZE = 20;
const ANCHOR_HIT_RADIUS = 14;

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

// Per-type default stroke colour, matching the CSS/SVG-export fallbacks. Used so
// the properties panel shows the colour a block is actually drawn with (e.g. a
// triangle is green, not the generic blue) when strokeColor isn't set yet.
const DEFAULT_STROKE_BY_TYPE: Record<string, string> = {
    rectangle: '#3b82f6',
    circle: '#ec4899',
    diamond: '#f59e0b',
    triangle: '#22c55e',
    sticky: '#eab308',
    'bpmn-task': '#3b82f6',
    'bpmn-event': '#22c55e',
    'bpmn-end': '#ef4444',
    'bpmn-gateway': '#eab308',
    'er-entity': '#1a56db',
    'er-attribute': '#1a56db',
    'er-relation': '#7c3aed',
};
function defaultStrokeColor(type: string): string {
    return DEFAULT_STROKE_BY_TYPE[type] ?? '#1a56db';
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
    isPublic?: boolean;
};

// ─── main component ───────────────────────────────────────────────────────────

export function DiagramEditorPage(props: DiagramEditorPageProps) {
    const { diagramId, diagramName, currentUserRole, initialEditorState, isPublic: initialIsPublic } = props;
    const { t, locale } = useLocale();
    const { mode, toggleMode } = useThemeMode();
    const toast = useToast();
    const router = useRouter();
    const queryClient = useQueryClient();
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const canvasContentRef = useRef<HTMLDivElement | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const drawioInputRef = useRef<HTMLInputElement | null>(null);

    const canEdit = currentUserRole === 'OWNER' || currentUserRole === 'EDITOR';
    const canDelete = currentUserRole === 'OWNER';

    const sessionUser = getSessionUser();
    const userId = String(sessionUser?.id ?? 0);
    const username = sessionUser?.username ?? 'Аноним';

    // ── canvas state ──────────────────────────────────────────────────────────
    const [elements, setElements] = useState<DiagramElement[]>(initialEditorState.blocks);
    const [template, _setTemplate] = useState(initialEditorState.template ?? 'uml');
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(40);
    const [panY, setPanY] = useState(40);
    const [editing, setEditing_] = useState<EditingBlock | null>(null);
    const editingRef = useRef<EditingBlock | null>(null);
    const setEditing = useCallback((val: EditingBlock | null) => {
        editingRef.current = val;
        setEditing_(val);
    }, []);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [canvasError] = useState<string | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── history ───────────────────────────────────────────────────────────────
    const historyRef = useRef<DiagramElement[][]>([]);
    const futureRef = useRef<DiagramElement[][]>([]);
    // Reactive flags mirroring the ref lengths so the undo/redo buttons can grey out.
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const elementsRef = useRef<DiagramElement[]>(initialEditorState.blocks);
    const dragSnapshotRef = useRef<DiagramElement[] | null>(null);
    const lastBroadcastedRef = useRef<Map<string, DiagramElement>>(
        new Map(initialEditorState.blocks.map(e => [(e as { id: string }).id, e])),
    );

    useEffect(() => { elementsRef.current = elements; }, [elements]);

    // ── selection ─────────────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const selectedIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
    const [selBox, setSelBox] = useState<SelBox | null>(null);
    const selBoxStartRef = useRef<{ x: number; y: number } | null>(null);

    // ── clipboard ─────────────────────────────────────────────────────────────
    const clipboardRef = useRef<DiagramCanvasBlock[]>([]);

    // ── drawing state ─────────────────────────────────────────────────────────
    const [tool, setTool] = useState<DrawingTool>('select');
    const [snapToGrid] = useState(false);
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
    // true while dragging a line endpoint — reveals block anchor dots so the user
    // sees where the line can snap/attach.
    const [draggingLineEnd, setDraggingLineEnd] = useState(false);

    // ── minimap canvas size ───────────────────────────────────────────────────
    const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

    // ── UI panels ─────────────────────────────────────────────────────────────
    const [leftPanel, setLeftPanel] = useState<LeftPanel>('none');
    const [menuOpen, setMenuOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [transparentBg, setTransparentBg] = useState(false);
    const [shapeSearch, setShapeSearch] = useState('');
    const [pendingPlacement, setPendingPlacement] = useState<DiagramElement[] | null>(null);
    const [pendingCursorPos, setPendingCursorPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
    const [groups, setGroups] = useState<BlockGroup[]>([]);

    // ── settings form ─────────────────────────────────────────────────────────
    const [renaming, setRenaming] = useState(diagramName);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isPublic, setIsPublic] = useState(initialIsPublic ?? false);
    const [linkCopied, setLinkCopied] = useState(false);

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const copyLink = () => {
        void navigator.clipboard.writeText(shareUrl).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    const handleTogglePublic = async () => {
        if (currentUserRole !== 'OWNER') return;
        const next = !isPublic;
        setIsPublic(next);
        try {
            await apiFetch(`/api/diagrams/${diagramId}/public`, {
                method: 'PUT',
                body: JSON.stringify({ isPublic: next }),
            });
        } catch {
            setIsPublic(!next);
        }
    };

    // ── block map (for connector resolution) ─────────────────────────────────
    const blockMap = useMemo(() => {
        const m = new Map<string, DiagramCanvasBlock>();
        elements.filter(isBlock).forEach((b) => m.set(b.id, b));
        return m;
    }, [elements]);

    // ── history helpers ───────────────────────────────────────────────────────
    // Push a snapshot onto the undo stack and clear the redo stack, keeping the
    // reactive can-undo/can-redo flags in sync.
    const recordHistory = useCallback((snapshot: DiagramElement[]) => {
        historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), snapshot];
        futureRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
    }, []);

    const pushHistory = useCallback(() => {
        recordHistory(elementsRef.current);
    }, [recordHistory]);

    const undo = useCallback(() => {
        const past = historyRef.current;
        if (!past.length) return;
        futureRef.current = [elementsRef.current, ...futureRef.current.slice(0, HISTORY_LIMIT - 1)];
        historyRef.current = past.slice(0, -1);
        setElements(past[past.length - 1]!);
        setSelectedIds(new Set());
        setSelectedLineId(null);
        setCanUndo(historyRef.current.length > 0);
        setCanRedo(true);
    }, []);

    const redo = useCallback(() => {
        const future = futureRef.current;
        if (!future.length) return;
        historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), elementsRef.current];
        futureRef.current = future.slice(1);
        setElements(future[0]!);
        setSelectedIds(new Set());
        setSelectedLineId(null);
        setCanUndo(true);
        setCanRedo(futureRef.current.length > 0);
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

    const onRemoteOp = useCallback((op: CollabBatchOp) => {
        setElements(prev => {
            const locked = selectedIdsRef.current;
            let next = [...prev];
            if (op.deletedIds?.length) {
                const delSet = new Set(op.deletedIds);
                // Don't delete elements the local user is currently selecting
                next = next.filter(e => !delSet.has((e as { id: string }).id) || locked.has((e as { id: string }).id));
            }
            if (op.updated?.length) {
                for (const upd of op.updated) {
                    const upId = (upd as { id: string }).id;
                    if (locked.has(upId)) continue; // Skip remote updates to locally-selected elements
                    const idx = next.findIndex(e => (e as { id: string }).id === upId);
                    if (idx >= 0) next[idx] = upd;
                }
            }
            if (op.added?.length) {
                const existIds = new Set(next.map(e => (e as { id: string }).id));
                for (const add of op.added) {
                    if (!existIds.has((add as { id: string }).id)) next.push(add);
                }
            }
            lastBroadcastedRef.current = new Map(next.map(e => [(e as { id: string }).id, e]));
            return next;
        });
    }, []);

    const { connected, broadcast, sendCursor, remoteUsers, remoteCursors } = useCollaboration({
        diagramId,
        userId,
        username,
        canEdit,
        onRemoteOp,
    });

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

    const alignBlocks = useCallback((how: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
        if (!canEdit || selectedIds.size < 2) return;
        pushHistory();
        setElements((cur) => {
            const sel = cur.filter(isBlock).filter((b) => selectedIds.has(b.id));
            return cur.map((el) => {
                if (!isBlock(el) || !selectedIds.has(el.id)) return el;
                let x = el.x, y = el.y;
                if (how === 'left')     x = Math.min(...sel.map((b) => b.x));
                if (how === 'right')  { const r = Math.max(...sel.map((b) => b.x + b.width));  x = r - el.width; }
                if (how === 'center-h') { const cx = sel.reduce((s, b) => s + b.x + b.width / 2, 0) / sel.length; x = cx - el.width / 2; }
                if (how === 'top')      y = Math.min(...sel.map((b) => b.y));
                if (how === 'bottom') { const bt = Math.max(...sel.map((b) => b.y + b.height)); y = bt - el.height; }
                if (how === 'center-v') { const cy = sel.reduce((s, b) => s + b.y + b.height / 2, 0) / sel.length; y = cy - el.height / 2; }
                return { ...el, x, y };
            });
        });
    }, [canEdit, selectedIds, pushHistory]);

    const distributeBlocks = useCallback((axis: 'h' | 'v') => {
        if (!canEdit || selectedIds.size < 3) return;
        pushHistory();
        setElements((cur) => {
            const sel = cur.filter(isBlock).filter((b) => selectedIds.has(b.id));
            if (axis === 'h') {
                const sorted = [...sel].sort((a, b) => a.x - b.x);
                const span = Math.max(...sorted.map((b) => b.x + b.width)) - sorted[0].x;
                const totalW = sorted.reduce((s, b) => s + b.width, 0);
                const gap = (span - totalW) / (sorted.length - 1);
                let cursor = sorted[0].x;
                const pos = new Map(sorted.map((b) => { const v = cursor; cursor += b.width + gap; return [b.id, v] as [string, number]; }));
                return cur.map((el) => isBlock(el) && selectedIds.has(el.id) ? { ...el, x: pos.get(el.id) ?? el.x } : el);
            } else {
                const sorted = [...sel].sort((a, b) => a.y - b.y);
                const span = Math.max(...sorted.map((b) => b.y + b.height)) - sorted[0].y;
                const totalH = sorted.reduce((s, b) => s + b.height, 0);
                const gap = (span - totalH) / (sorted.length - 1);
                let cursor = sorted[0].y;
                const pos = new Map(sorted.map((b) => { const v = cursor; cursor += b.height + gap; return [b.id, v] as [string, number]; }));
                return cur.map((el) => isBlock(el) && selectedIds.has(el.id) ? { ...el, y: pos.get(el.id) ?? el.y } : el);
            }
        });
    }, [canEdit, selectedIds, pushHistory]);

    // ── grouping ──────────────────────────────────────────────────────────────
    const groupSelected = useCallback(() => {
        if (!canEdit || selectedIds.size < 2) return;
        const existingGroupIds = new Set(groups.flatMap((g) => g.blockIds));
        const newIds = [...selectedIds].filter((id) => !existingGroupIds.has(id));
        if (newIds.length < 2) return;
        setGroups((cur) => [...cur, { id: generateId('group'), blockIds: newIds }]);
    }, [canEdit, selectedIds, groups]);

    const ungroupSelected = useCallback(() => {
        if (!canEdit || selectedIds.size === 0) return;
        setGroups((cur) => cur.filter((g) => !g.blockIds.some((id) => selectedIds.has(id))));
    }, [canEdit, selectedIds]);

    useEffect(() => {
        // Groups may contain both block and line ids — keep any element id alive.
        const existingIds = new Set(elements.map((el) => (el as { id: string }).id));
        setGroups((cur) => {
            const next = cur.map((g) => ({ ...g, blockIds: g.blockIds.filter((id) => existingIds.has(id)) })).filter((g) => g.blockIds.length >= 2);
            return next.length === cur.length && next.every((g, i) => g.blockIds.length === cur[i].blockIds.length) ? cur : next;
        });
    }, [elements]);

    // ── keyboard shortcuts ────────────────────────────────────────────────────
    const keyActionsRef = useRef({ undo, redo, copySelected, paste, deleteSelected, groupSelected, ungroupSelected });
    useEffect(() => { keyActionsRef.current = { undo, redo, copySelected, paste, deleteSelected, groupSelected, ungroupSelected }; });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const a = keyActionsRef.current;
            // Use e.code (physical key) instead of e.key so shortcuts work on
            // non-Latin layouts (e.g. Russian, where S→ы, H→р, Z→я, etc.).
            if (e.ctrlKey && !e.shiftKey && e.code === 'KeyZ') { e.preventDefault(); a.undo(); }
            else if (e.ctrlKey && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) { e.preventDefault(); a.redo(); }
            else if (e.ctrlKey && e.shiftKey && e.code === 'KeyG') { e.preventDefault(); a.ungroupSelected(); }
            else if (e.ctrlKey && !e.shiftKey && e.code === 'KeyG') { e.preventDefault(); a.groupSelected(); }
            else if (e.ctrlKey && e.code === 'KeyC') { a.copySelected(); }
            else if (e.ctrlKey && e.code === 'KeyV') { e.preventDefault(); a.paste(); }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey) { e.preventDefault(); a.deleteSelected(); }
            else if (e.key === 'Escape') { setPendingPlacement(null); setSelectedIds(new Set()); setSelectedLineId(null); setEditing(null); }
            else if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyS') { setTool('select'); }
            else if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyH') { setTool('pan'); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);  

    // ── save ──────────────────────────────────────────────────────────────────
    const saveNow = useCallback(async (els: DiagramElement[]) => {
        setSaveStatus('saving');
        try {
            await saveDiagramEditorState(diagramId, { template, blocks: els });
            await queryClient.invalidateQueries({ queryKey: ['diagramEditor', diagramId] });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
            toast.error('Не удалось сохранить диаграмму');
        }
    }, [diagramId, template, toast]);

    useEffect(() => {
        if (saveStatus !== 'error') return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [saveStatus]);

    useEffect(() => {
        if (!canEdit) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => void saveNow(elements), 2000);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [elements, canEdit, saveNow]);

    // ── broadcast canvas changes to collaborators ─────────────────────────────
    useEffect(() => {
        if (!connected || !canEdit) return;
        const prev = lastBroadcastedRef.current;
        const curr = new Map(elements.map(e => [(e as { id: string }).id, e]));
        const added: DiagramElement[] = [];
        const updated: DiagramElement[] = [];
        const deletedIds: string[] = [];
        for (const [id, el] of curr) {
            if (!prev.has(id)) added.push(el);
            else if (prev.get(id) !== el) updated.push(el);
        }
        for (const id of prev.keys()) {
            if (!curr.has(id)) deletedIds.push(id);
        }
        if (added.length || updated.length || deletedIds.length) {
            broadcast({ added, updated, deletedIds });
            lastBroadcastedRef.current = curr;
        }
    }, [elements, connected, canEdit, broadcast]);

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
        if (pendingPlacement) return;
        const targetEl = e.target as Element;
        if (targetEl.closest('[data-block]')) return;
        // Clicking a line's hit-area: let the line's own onClick handle selection.
        // Capturing the pointer / starting a marquee here would swallow that click.
        if ((tool === 'select' || tool === 'eraser') && targetEl.closest('[data-line]')) return;

        if (tool === 'pan') {
            e.currentTarget.setPointerCapture(e.pointerId);
            panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: panX, scrollTop: panY };
            setIsPanning(true);
            return;
        }

        if (tool === 'select') {
            // Flush any active block edit (saving its latest title/body) instead of
            // discarding it via setEditing(null). commitEdit() reads editingRef.current,
            // persists the changes, then clears editing — so clicking the canvas saves.
            commitEdit();
            setSelectedIds(new Set()); setSelectedLineId(null);
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
        const _cp = getCanvasPoint(e.clientX, e.clientY);
        sendCursor(_cp.x, _cp.y);
        if (pendingPlacement) { setPendingCursorPos(_cp); }
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
                    // Lines join the selection when both endpoints fall inside the box,
                    // so they can be grouped together with blocks.
                    const linesInBox = elements.filter(isLine).filter((l) => {
                        const c = resolveLineCoords(l, blockMap);
                        return c.x1 >= minX && c.x1 <= maxX && c.y1 >= minY && c.y1 <= maxY
                            && c.x2 >= minX && c.x2 <= maxX && c.y2 >= minY && c.y2 <= maxY;
                    });
                    // Pencil strokes join when all of their points fall inside the box.
                    const pencilsInBox = elements.filter(isPencil).filter((p) =>
                        p.points.length > 0 && p.points.every(([px, py]) => px >= minX && px <= maxX && py >= minY && py <= maxY),
                    );
                    setSelectedIds(new Set([...inBox.map((b) => b.id), ...linesInBox.map((l) => l.id), ...pencilsInBox.map((p) => p.id)]));
                    setSelectedLineId(null);
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
        const c = viewportCenter();
        const block = createBlock(tpl, id, Math.round(c.x - tpl.width / 2), Math.round(c.y - tpl.height / 2));
        setElements((cur) => [...cur, block]);
        setTool('select');
        // Text/comment blocks start empty (invisible) — open the editor immediately
        // so the user can type, otherwise it looks like nothing happened.
        if (tpl.type === 'text' || tpl.type === 'comment') {
            setSelectedIds(new Set([id]));
            setEditing({ id, title: block.title, body: block.body });
        }
    };

    // Normalise imported/preset elements to origin (0,0) so they can follow the cursor
    const normalizeForPlacement = (els: DiagramElement[]): DiagramElement[] => {
        let minX = Infinity, minY = Infinity;
        for (const el of els) {
            if (isBlock(el)) { minX = Math.min(minX, el.x); minY = Math.min(minY, el.y); }
        }
        if (!isFinite(minX)) return els;
        return els.map((el) => {
            if (isBlock(el)) return { ...el, x: el.x - minX, y: el.y - minY };
            if (isLine(el)) return { ...el, x1: el.x1 - minX, y1: el.y1 - minY, x2: el.x2 - minX, y2: el.y2 - minY };
            if (isPencil(el)) return { ...el, points: el.points.map(([px, py]) => [px - minX, py - minY] as [number, number]) };
            return el;
        });
    };

    const placePendingElements = (cursorX: number, cursorY: number) => {
        if (!pendingPlacement) return;
        const idMap = new Map<string, string>();
        pendingPlacement.filter(isBlock).forEach((b) => idMap.set(b.id, generateId(b.type)));
        const placed = pendingPlacement.map((el) => {
            if (isBlock(el)) return { ...el, id: idMap.get(el.id)!, x: Math.round(cursorX + el.x), y: Math.round(cursorY + el.y) };
            if (isLine(el)) return { ...el, id: generateId('line'), fromBlockId: el.fromBlockId ? idMap.get(el.fromBlockId) : undefined, toBlockId: el.toBlockId ? idMap.get(el.toBlockId) : undefined, x1: cursorX + el.x1, y1: cursorY + el.y1, x2: cursorX + el.x2, y2: cursorY + el.y2 };
            if (isPencil(el)) return { ...el, id: generateId('pencil'), points: el.points.map(([px, py]) => [cursorX + px, cursorY + py] as [number, number]) };
            return el;
        });
        pushHistory();
        setElements((cur) => [...cur, ...placed]);
        setPendingPlacement(null);
    };

    // ── editing ───────────────────────────────────────────────────────────────
    const startEditing = (block: DiagramCanvasBlock) => {
        if (!canEdit || tool !== 'select' || block.type === 'image') return;
        setEditing({ id: block.id, title: block.title, body: block.body });
    };
    const commitEdit = useCallback(() => {
        const e = editingRef.current;
        if (!e) return;
        const block = elementsRef.current.find((el) => isBlock(el) && el.id === e.id) as DiagramCanvasBlock | undefined;
        // Drop text/comment blocks left empty — an invisible empty block is just clutter.
        if (block && isTextBlock(block) && e.title.trim() === '' && e.body.trim() === '') {
            pushHistory();
            removeEl(e.id);
            setEditing(null);
            return;
        }
        pushHistory();
        updateEl(e.id, { title: e.title, body: e.body });
        setEditing(null);
    }, [pushHistory, updateEl, removeEl, setEditing]);

    // Cancel editing (Escape): discard edits, and drop a still-empty text block.
    const cancelEditing = useCallback(() => {
        const e = editingRef.current;
        if (e) {
            const block = elementsRef.current.find((el) => isBlock(el) && el.id === e.id) as DiagramCanvasBlock | undefined;
            if (block && isTextBlock(block) && (block.title ?? '').trim() === '' && (block.body ?? '').trim() === '') {
                pushHistory();
                removeEl(e.id);
            }
        }
        setEditing(null);
    }, [pushHistory, removeEl, setEditing]);

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

    // Drag a set of elements (blocks + lines) together by the pointer delta. Free
    // line endpoints translate; anchored endpoints follow their block. Records a
    // single history entry on release. Used for both block-grab and line-grab moves.
    const beginElementsDrag = (moveIds: Set<string>, startClientX: number, startClientY: number) => {
        const blockStarts = new Map<string, { x: number; y: number }>(
            elementsRef.current.filter(isBlock).filter((b) => moveIds.has(b.id)).map((b) => [b.id, { x: b.x, y: b.y }]),
        );
        const lineStarts = new Map<string, { x1: number; y1: number; x2: number; y2: number; fromAnchored: boolean; toAnchored: boolean }>(
            elementsRef.current.filter(isLine).filter((l) => moveIds.has(l.id)).map((l) => [l.id, {
                x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2,
                fromAnchored: !!(l.fromBlockId && l.fromAnchor),
                toAnchored: !!(l.toBlockId && l.toAnchor),
            }]),
        );
        const pencilStarts = new Map<string, [number, number][]>(
            elementsRef.current.filter(isPencil).filter((p) => moveIds.has(p.id)).map((p) => [p.id, p.points]),
        );
        dragSnapshotRef.current = [...elementsRef.current];
        let moved = false;
        const currentZoom = zoom;
        const COORD_LIMIT = 50000;
        const move = (me: PointerEvent) => {
            moved = true;
            const dx = snapV((me.clientX - startClientX) / currentZoom, snapToGrid);
            const dy = snapV((me.clientY - startClientY) / currentZoom, snapToGrid);
            setElements((cur) => cur.map((el) => {
                if (isBlock(el) && moveIds.has(el.id)) {
                    const start = blockStarts.get(el.id);
                    if (!start) return el;
                    const nx = snapV(start.x + dx, snapToGrid);
                    const ny = snapV(start.y + dy, snapToGrid);
                    if (!isFinite(nx) || !isFinite(ny)) return el;
                    return { ...el, x: Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, nx)), y: Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, ny)) };
                }
                if (isLine(el) && moveIds.has(el.id)) {
                    const ls = lineStarts.get(el.id);
                    if (!ls) return el;
                    return {
                        ...el,
                        ...(ls.fromAnchored ? {} : { x1: ls.x1 + dx, y1: ls.y1 + dy }),
                        ...(ls.toAnchored ? {} : { x2: ls.x2 + dx, y2: ls.y2 + dy }),
                    };
                }
                if (isPencil(el) && moveIds.has(el.id)) {
                    const pts = pencilStarts.get(el.id);
                    if (!pts) return el;
                    return { ...el, points: pts.map(([px, py]) => [px + dx, py + dy] as [number, number]) };
                }
                return el;
            }));
        };
        const up = () => {
            if (moved && dragSnapshotRef.current) recordHistory(dragSnapshotRef.current);
            dragSnapshotRef.current = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // ── block pointer events ──────────────────────────────────────────────────
    const onBlockPointerDown = (e: ReactPointerEvent<HTMLDivElement>, block: DiagramCanvasBlock) => {
        if (pendingPlacement) return;
        if (tool === 'pan') return;
        if (tool === 'eraser') { pushHistory(); removeEl(block.id); return; }
        if (!canEdit || editing?.id === block.id) return;
        if (tool === 'line') return; // handled via anchor dots

        // Flush any edit on a different block before selecting/moving this one
        // (blur may not fire when the new target isn't focusable).
        commitEdit();

        const group = groups.find((g) => g.blockIds.includes(block.id));
        const groupIds = group ? new Set(group.blockIds) : null;
        const moveIds: Set<string> = selectedIds.has(block.id)
            ? new Set(selectedIds)
            : groupIds && !e.shiftKey
                ? groupIds
                : new Set([block.id]);
        if (e.shiftKey) {
            setSelectedIds((prev) => { const n = new Set(prev); if (n.has(block.id)) { n.delete(block.id); } else { n.add(block.id); } return n; });
            return;
        }
        if (!selectedIds.has(block.id)) setSelectedIds(moveIds);
        setSelectedLineId(null);

        e.currentTarget.setPointerCapture(e.pointerId);
        beginElementsDrag(moveIds, e.clientX, e.clientY);
    };

    const onBlockResize = (e: ReactPointerEvent<HTMLButtonElement>, block: DiagramCanvasBlock) => {
        if (!canEdit || tool !== 'select') return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const sx = e.clientX, sy = e.clientY, sw = block.width, sh = block.height;
        dragSnapshotRef.current = [...elementsRef.current];
        const currentZoom = zoom;
        // BPMN/ER/mockup blocks are intentionally small — keep their minimums low
        // so resizing matches their real (sub-80×60) dimensions.
        const compact = isBpmnBlockType(block.type) || isErBlockType(block.type) || isMockupBlockType(block.type);
        const minW = compact ? 24 : 80, minH = compact ? 24 : 60;
        const move = (me: PointerEvent) => updateEl(block.id, {
            width: Math.max(minW, snapV(sw + (me.clientX - sx) / currentZoom, snapToGrid)),
            height: Math.max(minH, snapV(sh + (me.clientY - sy) / currentZoom, snapToGrid)),
        });
        const up = () => {
            if (dragSnapshotRef.current) { recordHistory(dragSnapshotRef.current); dragSnapshotRef.current = null; }
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // ── line dragging ─────────────────────────────────────────────────────────
    // Drag the whole line: translates both endpoints. Endpoints anchored to a
    // block stay glued to it (binding is preserved), only free endpoints move.
    const onLinePointerDown = (e: ReactPointerEvent<SVGLineElement>, line: DiagramLineElement) => {
        if (!canEdit || tool !== 'select') return;
        e.stopPropagation();

        // If the line belongs to a group, grabbing it drags the whole group.
        const group = groups.find((g) => g.blockIds.includes(line.id));
        if (group) {
            const moveIds = new Set(group.blockIds);
            setSelectedIds(moveIds);
            setSelectedLineId(null);
            beginElementsDrag(moveIds, e.clientX, e.clientY);
            return;
        }

        setSelectedLineId(line.id);
        setSelectedIds(new Set());
        const fromAnchored = !!(line.fromBlockId && line.fromAnchor);
        const toAnchored = !!(line.toBlockId && line.toAnchor);
        if (fromAnchored && toAnchored) return; // fully bound to blocks — nothing to move
        const sx = e.clientX, sy = e.clientY;
        const start = { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 };
        dragSnapshotRef.current = [...elementsRef.current];
        const currentZoom = zoom;
        let moved = false;
        const move = (me: PointerEvent) => {
            moved = true;
            const dx = (me.clientX - sx) / currentZoom;
            const dy = (me.clientY - sy) / currentZoom;
            updateLine(line.id, {
                ...(fromAnchored ? {} : { x1: start.x1 + dx, y1: start.y1 + dy }),
                ...(toAnchored ? {} : { x2: start.x2 + dx, y2: start.y2 + dy }),
            });
        };
        const up = () => {
            if (moved && dragSnapshotRef.current) {
                recordHistory(dragSnapshotRef.current);
            }
            dragSnapshotRef.current = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // Drag a single endpoint of the selected line. Snaps to a block anchor when
    // released near one (sets the binding), otherwise becomes a free coordinate.
    const onLineEndpointPointerDown = (e: ReactPointerEvent<SVGCircleElement>, line: DiagramLineElement, which: 'start' | 'end') => {
        if (!canEdit || tool !== 'select') return;
        e.stopPropagation();
        setDraggingLineEnd(true);
        dragSnapshotRef.current = [...elementsRef.current];
        let moved = false;
        const move = (me: PointerEvent) => {
            moved = true;
            const pt = getCanvasPoint(me.clientX, me.clientY);
            const near = findNearestAnchor(pt);
            let x = pt.x, y = pt.y;
            if (near) { const b = blockMap.get(near.blockId)!; const ap = getAnchorPoint(b, near.side); x = ap.x; y = ap.y; }
            setAnchorHover(near);
            if (which === 'start') {
                updateLine(line.id, near
                    ? { x1: x, y1: y, fromBlockId: near.blockId, fromAnchor: near.side }
                    : { x1: x, y1: y, fromBlockId: undefined, fromAnchor: undefined });
            } else {
                updateLine(line.id, near
                    ? { x2: x, y2: y, toBlockId: near.blockId, toAnchor: near.side }
                    : { x2: x, y2: y, toBlockId: undefined, toAnchor: undefined });
            }
        };
        const up = () => {
            setAnchorHover(null);
            setDraggingLineEnd(false);
            if (moved && dragSnapshotRef.current) {
                recordHistory(dragSnapshotRef.current);
            }
            dragSnapshotRef.current = null;
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
            const lineStr = `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="${stroke}" stroke-width="${sw}" ${sd(l.style)} ${em(l.endEnding,'e') ? `marker-end="${em(l.endEnding,'e')}"`:''} ${em(l.startEnding,'s') ? `marker-start="${em(l.startEnding,'s')}"`:''} />`;
            if (!l.rotation) return lineStr;
            return `<g transform="rotate(${l.rotation} ${(c.x1 + c.x2) / 2} ${(c.y1 + c.y2) / 2})">${lineStr}</g>`;
        }).join('\n');
        const svgPencil = elements.filter(isPencil).map((p) => `<path d="${pointsToPath(p.points)}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n');
        const blockToSvg = (b: DiagramCanvasBlock): string => {
            const x = b.x, y = b.y, w = b.width, h = b.height;
            const sc = esc(b.strokeColor ?? '#1a56db'), fc = b.fillColor ? esc(b.fillColor) : undefined;
            if (b.type === 'image') return b.src ? `<image href="${b.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>` : '';
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
                const labelFill = b.textColor ? esc(b.textColor) : '#1f2937';
                return `${shapeEl}\n<text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" dominant-baseline="middle" font-size="${b.fontSize??13}" font-weight="600" fill="${labelFill}">${esc(b.title)}</text>`;
            }
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fc??'#fff'}" stroke="${sc??'#1a56db'}" stroke-width="2" rx="10"/>
<rect x="${x}" y="${y}" width="${w}" height="32" fill="${sc??'#1a56db'}" rx="10"/>
<rect x="${x}" y="${y+22}" width="${w}" height="10" fill="${sc??'#1a56db'}"/>
<text x="${x+w/2}" y="${y+16}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#fff">${esc(b.title)}</text>
<text x="${x+10}" y="${y+48}" font-size="12" fill="#000" font-family="Consolas,monospace">${esc(b.body)}</text>`;
        };
        const svgBlocks = elements.filter(isBlock).map((b) => {
            const inner = blockToSvg(b);
            if (!b.rotation) return inner;
            const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
            return `<g transform="rotate(${b.rotation} ${cx} ${cy})">${inner}</g>`;
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
                doc.querySelectorAll<HTMLElement>('[aria-label="Resize block"]').forEach((el) => { el.style.display = 'none'; });
                doc.querySelectorAll<HTMLElement>('[class*="AnchorDot"]').forEach((el) => { el.style.display = 'none'; });
            },
            ...(bounds ?? {}),
        });
        setZoom(savedZoom); setPanX(savedPanX); setPanY(savedPanY);
        return canvas;
    };

    const handleExport = async (format: ExportFormat) => {
        setIsExporting(true);
        // Yield two frames so React can paint the loading indicator before the
        // main thread is blocked by html2canvas or PDF generation.
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
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

    const handleDeleteConfirm = async () => {
        setDeleteConfirmOpen(false);
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
    const lineStyleOpts = useMemo<SelectOption[]>(() => [
        { value: 'solid', label: t.editor.lineStyleSolid },
        { value: 'dashed', label: t.editor.lineStyleDashed },
        { value: 'dotted', label: t.editor.lineStyleDotted },
    ], [t]);
    const endingOpts = useMemo<SelectOption[]>(() => [
        { value: 'none', label: t.editor.endingNone },
        { value: 'arrow', label: t.editor.endingArrow },
        { value: 'open-arrow', label: t.editor.endingOpenArrow },
        { value: 'circle-end', label: t.editor.endingCircle },
    ], [t]);
    const isDrawing = tool === 'line' || tool === 'pencil';

    const filteredShapes = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? SHAPE_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || (t.nameRu ?? '').toLowerCase().includes(q)) : SHAPE_BLOCK_TEMPLATES; }, [shapeSearch]);
    const filteredBpmn = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? BPMN_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || (t.nameRu ?? '').toLowerCase().includes(q)) : BPMN_BLOCK_TEMPLATES; }, [shapeSearch]);
    const filteredEr = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? ER_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || (t.nameRu ?? '').toLowerCase().includes(q)) : ER_BLOCK_TEMPLATES; }, [shapeSearch]);
    const filteredMockup = useMemo(() => { const q = shapeSearch.toLowerCase(); return q ? MOCKUP_BLOCK_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || (t.nameRu ?? '').toLowerCase().includes(q)) : MOCKUP_BLOCK_TEMPLATES; }, [shapeSearch]);

    const viewportCenter = () => {
        const rect = canvasRef.current?.getBoundingClientRect();
        return {
            x: rect ? (rect.width / 2 - panX) / zoom : 100,
            y: rect ? (rect.height / 2 - panY) / zoom : 100,
        };
    };

    const addPreset = (preset: FlowchartPreset) => {
        const normalized = normalizeForPlacement(preset.generate(0, 0));
        setPendingPlacement(normalized);
        setLeftPanel('none');
    };

    // ── image insert ────────────────────────────────────────────────────────────
    const insertImageFile = (file: File) => {
        if (!file.type.startsWith('image/')) { toast.error('Можно вставить только изображение'); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error('Изображение слишком большое (максимум 5 МБ)'); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const src = typeof reader.result === 'string' ? reader.result : '';
            if (!src) return;
            const img = new Image();
            img.onload = () => {
                const maxDim = 320;
                let w = img.width || 200, h = img.height || 150;
                if (w > maxDim || h > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
                const c = viewportCenter();
                pushHistory();
                setElements((cur) => [...cur, {
                    id: generateId('image'), type: 'image', title: file.name, body: '', src,
                    x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), width: w, height: h,
                }]);
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    };

    // ── draw.io import ──────────────────────────────────────────────────────────
    const importDrawioFile = async (file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Файл слишком большой (максимум 10 МБ)');
            return;
        }
        try {
            const text = await file.text();
            const { parseDrawioToElements } = await import('../api/drawioImport');
            const imported = await parseDrawioToElements(text);
            const normalized = normalizeForPlacement(imported);
            setPendingPlacement(normalized);
            setLeftPanel('none');
            toast.success(`Импортировано блоков: ${imported.filter(isBlock).length}. Нажмите на холст для размещения.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка импорта draw.io');
        }
    };

    // ── minimap ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setCanvasSize({ w: width, h: height });
        });
        ro.observe(el);
        const r = el.getBoundingClientRect();
        setCanvasSize({ w: r.width, h: r.height });
        return () => ro.disconnect();
    }, []);

    const minimapBounds = useMemo(() => {
        const PAD = 32;
        const content = getContentBounds(); // eslint-disable-line react-hooks/exhaustive-deps
        let minX = content ? content.x - PAD : Infinity;
        let minY = content ? content.y - PAD : Infinity;
        let maxX = content ? content.x + content.width + PAD : -Infinity;
        let maxY = content ? content.y + content.height + PAD : -Infinity;
        if (canvasSize.w > 0) {
            const vpX = -panX / zoom, vpY = -panY / zoom;
            const vpW = canvasSize.w / zoom, vpH = canvasSize.h / zoom;
            minX = Math.min(minX, vpX - PAD);
            minY = Math.min(minY, vpY - PAD);
            maxX = Math.max(maxX, vpX + vpW + PAD);
            maxY = Math.max(maxY, vpY + vpH + PAD);
        }
        if (!isFinite(minX)) return null;
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }, [elements, panX, panY, zoom, canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps
    const MINI_W = 160, MINI_H = 90;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className={styles.Page}>

            {/* ── hidden file inputs ── */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                hidden
                data-testid="image-input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImageFile(f); e.target.value = ''; }}
            />
            <input
                ref={drawioInputRef}
                type="file"
                accept=".drawio,.xml,application/xml,text/xml"
                hidden
                data-testid="drawio-input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void importDrawioFile(f); e.target.value = ''; }}
            />

            {/* ── TOP BAR ── */}
            <header className={styles.TopBar}>
                <button type="button" className={styles.TopBarBtn} title={t.common.backToList} onClick={() => router.push('/diagrams')}>
                    <ArrowBackOutlinedIcon fontSize="small" />
                </button>
                <span className={styles.DiagramName}>{renaming !== diagramName ? renaming : diagramName}</span>
                <div className={styles.TopBarRight}>
                    {canEdit && saveStatus !== 'idle' ? (
                        <span className={`${styles.SaveStatus} ${styles[`SaveStatus_${saveStatus}`]}`}>
                            {saveStatus === 'saving' ? t.editor.savingStatus : saveStatus === 'saved' ? t.editor.savedStatus : t.editor.saveErrorStatus}
                        </span>
                    ) : null}
                    <CollaborationAvatars users={remoteUsers} />
                    {canEdit ? (
                        <>
                            <button type="button" className={styles.TopBarBtn} title={t.editor.undo} onClick={undo} disabled={!canUndo}><UndoOutlinedIcon fontSize="small" /></button>
                            <button type="button" className={styles.TopBarBtn} title={t.editor.redo} onClick={redo} disabled={!canRedo}><RedoOutlinedIcon fontSize="small" /></button>
                        </>
                    ) : null}
                    <LanguageSwitcher showCode />
                    <button type="button" className={styles.TopBarBtn} title={mode === 'dark' ? t.editor.themeDark : t.editor.themeLight} onClick={toggleMode}>
                        {mode === 'dark' ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
                    </button>
                    <button type="button" className={styles.TopBarBtn} title={t.editor.download} onClick={() => { setExportOpen(true); setMenuOpen(false); }}>
                        <FileDownloadOutlinedIcon fontSize="small" />
                    </button>
                    <button type="button" className={`${styles.TopBarBtn} ${menuOpen ? styles.TopBarBtn_active : ''}`} title={t.editor.settings} onClick={() => { setMenuOpen((o) => !o); setLeftPanel('none'); }}>
                        <MoreVertOutlinedIcon fontSize="small" />
                    </button>
                </div>
            </header>

            {/* ── SAVE ERROR BANNER ── */}
            {saveStatus === 'error' ? (
                <div className={styles.SaveErrorBanner}>
                    <span>{t.editor.saveErrorBanner}</span>
                    <button type="button" onClick={() => void saveNow(elementsRef.current)}>
                        {t.editor.retryBtn}
                    </button>
                </div>
            ) : null}

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
                        ) : (
                            <div className={styles.SettingsRow}>
                                <Typography variant="body2" style={{ fontWeight: 600 }}>{diagramName}</Typography>
                            </div>
                        )}
                        {currentUserRole === 'OWNER' ? (
                            <div className={styles.SettingsRow}>
                                <Typography variant="caption" style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary, #888)' }}>{t.editor.settingsAccess}</Typography>
                                <label className={styles.PublicToggle}>
                                    <span>{t.editor.settingsPublicView}</span>
                                    <button type="button" role="switch" aria-checked={isPublic} className={`${styles.ToggleSwitch} ${isPublic ? styles.ToggleSwitch_on : ''}`} onClick={() => void handleTogglePublic()} />
                                </label>
                            </div>
                        ) : null}
                        {(isPublic || currentUserRole === 'OWNER') ? (
                            <div className={styles.ShareLinkRow}>
                                <span className={styles.ShareLinkText} title={shareUrl}>{shareUrl}</span>
                                <button type="button" className={styles.CopyBtn} onClick={copyLink}>{linkCopied ? '✓' : 'Копировать'}</button>
                            </div>
                        ) : null}
                        {sessionUser ? (
                            <Button variant="outlined" size="small" component={Link} href={`/diagrams/${diagramId}/participants`} style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setMenuOpen(false)}>
                                <GroupsOutlinedIcon fontSize="small" />{t.common.participants}
                            </Button>
                        ) : null}
                        {canDelete ? (
                            <Button variant="outlined" color="error" size="small" loading={isDeleting} disabled={isRenaming} style={{ justifyContent: 'flex-start', gap: 8 }} onClick={() => setDeleteConfirmOpen(true)}>
                                <DeleteOutlineOutlinedIcon fontSize="small" />{t.diagrams.deleteDiagram}
                            </Button>
                        ) : null}
                    </aside>
                </>
            ) : null}

            <ConfirmModal
                open={deleteConfirmOpen}
                message={t.diagrams.deleteConfirm(renaming)}
                dangerous
                onConfirm={() => void handleDeleteConfirm()}
                onCancel={() => setDeleteConfirmOpen(false)}
            />

            {/* ── EXPORT MODAL ── */}
            {exportOpen ? (
                <>
                    <div className={styles.ModalOverlay} onClick={() => !isExporting && setExportOpen(false)} />
                    <div className={styles.Modal} role="dialog" aria-modal="true">
                        <Typography variant="h6" style={{ marginBottom: 4 }}>{t.editor.exportTitle}</Typography>
                        <Typography variant="body2" color="text.secondary" style={{ marginBottom: 16 }}>{t.editor.exportSubtitle}</Typography>
                        <label className={styles.TransparentToggle}>
                            <input type="checkbox" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)} />
                            {t.editor.exportTransparentBg}
                        </label>
                        <div className={styles.FormatGrid}>
                            {(['json', 'svg', 'png', 'jpeg', 'pdf'] as ExportFormat[]).map((fmt) => (
                                <button key={fmt} type="button" className={styles.FormatBtn} disabled={isExporting || (transparentBg && fmt !== 'png' && fmt !== 'svg')} onClick={() => void handleExport(fmt)}>
                                    <span className={styles.FormatExt}>{fmt.toUpperCase()}</span>
                                    <span className={styles.FormatDesc}>{fmt === 'json' ? t.editor.exportFormatJson : fmt === 'svg' ? t.editor.exportFormatSvg : fmt === 'png' ? 'PNG' : fmt === 'jpeg' ? 'JPEG' : 'PDF'}</span>
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
                    <button type="button" title={t.editor.toolSelect} className={`${styles.ToolBtn} ${tool === 'select' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('select')}>
                        <NearMeOutlinedIcon fontSize="small" />
                    </button>
                    <button type="button" title={t.editor.toolPan} className={`${styles.ToolBtn} ${tool === 'pan' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('pan')}>
                        <PanToolOutlinedIcon fontSize="small" />
                    </button>
                    {canEdit ? (
                        <>
                            <button type="button" title={t.editor.toolEraser} className={`${styles.ToolBtn} ${tool === 'eraser' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('eraser')}>
                                <EraserIcon />
                            </button>
                            <button type="button" title={t.editor.toolPencil} className={`${styles.ToolBtn} ${tool === 'pencil' ? styles.ToolBtn_active : ''}`} onClick={() => selectTool('pencil')}>
                                <GestureOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title={t.editor.toolLine} className={`${styles.ToolBtn} ${tool === 'line' ? styles.ToolBtn_active : ''} ${leftPanel === 'line-config' ? styles.ToolBtn_panel : ''}`} onClick={() => { setTool('line'); togglePanel('line-config'); }}>
                                <TimelineOutlinedIcon fontSize="small" />
                            </button>
                            <div className={styles.ToolbarDivider} />
                            <button type="button" title={t.editor.toolShapes} className={`${styles.ToolBtn} ${leftPanel === 'shapes' ? styles.ToolBtn_panel : ''}`} onClick={() => togglePanel('shapes')}>
                                <CategoryOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title={t.editor.toolText} className={styles.ToolBtn} onClick={() => { const tpl = TEXT_BLOCK_TEMPLATES.find((tpl) => tpl.type === 'text'); if (tpl) addBlock(tpl); }}>
                                <TextFieldsOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title={t.editor.toolTemplates} className={`${styles.ToolBtn} ${['templates','uml','bpmn','er','mockup','flowchart'].includes(leftPanel) ? styles.ToolBtn_panel : ''}`} onClick={() => togglePanel('templates')}>
                                <TableChartOutlinedIcon fontSize="small" />
                            </button>
                            <button type="button" title={t.editor.toolImage} className={styles.ToolBtn} onClick={() => imageInputRef.current?.click()}>
                                <ImageOutlinedIcon fontSize="small" />
                            </button>
                            <div className={styles.ToolbarDivider} />
                        </>
                    ) : null}
                    <div className={styles.ToolbarSpacer} />
                    <button type="button" className={styles.ZoomBtn} title={t.editor.zoomOut} onClick={() => clampZoom(zoom - ZOOM_STEP)}>−</button>
                    <button type="button" className={styles.ZoomLabel} title={t.editor.zoomReset} onClick={() => { setZoom(1); setPanX(40); setPanY(40); }}>{Math.round(zoom * 100)}%</button>
                    <button type="button" className={styles.ZoomBtn} title={t.editor.zoomIn} onClick={() => clampZoom(zoom + ZOOM_STEP)}>+</button>
                </nav>

                {/* ── LEFT PANELS ── */}
                {leftPanel === 'shapes' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelBasicShapes}</Typography>
                        <input className={styles.PanelSearch} placeholder={t.editor.panelSearchShapes} value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredShapes.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{locale === 'ru' && tpl.nameRu ? tpl.nameRu : tpl.name}</button>
                        ))}
                        {filteredShapes.length === 0 ? <Typography variant="body2" color="text.secondary">{t.editor.panelNotFound}</Typography> : null}
                    </div>
                ) : leftPanel === 'templates' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelLibraries}</Typography>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('uml')}>{t.editor.panelUml}</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('bpmn')}>{t.editor.panelBpmn}</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('er')}>{t.editor.panelEr}</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('mockup')}>{t.editor.panelMockup}</button>
                        <button type="button" className={styles.PaletteItem} onClick={() => setLeftPanel('flowchart')}>{t.editor.panelPresets}</button>
                        <div className={styles.ToolbarDivider} />
                        <button type="button" className={styles.PaletteItem} onClick={() => drawioInputRef.current?.click()}>{t.editor.panelImportDrawio}</button>
                    </div>
                ) : leftPanel === 'uml' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>{t.editor.panelBack}</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelUml}</Typography>
                        {UML_BLOCK_TEMPLATES.map((tpl) => (
                            <button key={tpl.type} type="button" className={styles.PaletteItem} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                    </div>
                ) : leftPanel === 'bpmn' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>{t.editor.panelBack}</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelBpmn}</Typography>
                        <input className={styles.PanelSearch} placeholder={t.editor.panelSearch} value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredBpmn.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredBpmn.length === 0 ? <Typography variant="body2" color="text.secondary">{t.editor.panelNotFound}</Typography> : null}
                    </div>
                ) : leftPanel === 'er' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>{t.editor.panelBack}</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelEr}</Typography>
                        <input className={styles.PanelSearch} placeholder={t.editor.panelSearch} value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredEr.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredEr.length === 0 ? <Typography variant="body2" color="text.secondary">{t.editor.panelNotFound}</Typography> : null}
                    </div>
                ) : leftPanel === 'mockup' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>{t.editor.panelBack}</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelMockup}</Typography>
                        <input className={styles.PanelSearch} placeholder={t.editor.panelSearch} value={shapeSearch} onChange={(e) => setShapeSearch(e.target.value)} />
                        {filteredMockup.map((tpl) => (
                            <button key={tpl.type} type="button" className={`${styles.PaletteItem} ${styles[`PaletteItem_${tpl.type}`]}`} draggable onClick={() => addBlock(tpl)} onDragStart={(e) => onDragStart(e, tpl.type)}>{tpl.name}</button>
                        ))}
                        {filteredMockup.length === 0 ? <Typography variant="body2" color="text.secondary">{t.editor.panelNotFound}</Typography> : null}
                    </div>
                ) : leftPanel === 'flowchart' ? (
                    <div className={styles.LeftPanel}>
                        <button type="button" className={styles.PanelBack} onClick={() => setLeftPanel('templates')}>{t.editor.panelBack}</button>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelPresets}</Typography>
                        <Typography variant="caption" color="text.secondary" style={{ marginBottom: 8, display: 'block' }}>{t.editor.panelPresetHint}</Typography>
                        {FLOWCHART_PRESETS.map((preset) => (
                            <button key={preset.name} type="button" className={styles.PresetItem} onClick={() => addPreset(preset)}>
                                <span className={styles.PresetName}>{preset.name}</span>
                                <span className={styles.PresetDesc}>{preset.description}</span>
                            </button>
                        ))}
                    </div>
                ) : leftPanel === 'line-config' ? (
                    <div className={styles.LeftPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.panelLineConfig}</Typography>
                        <Select label={t.editor.lineStyle} value={lineStyle} onChange={(v) => setLineStyle(v as LineStyle)} options={lineStyleOpts} />
                        <Select label={t.editor.lineStart} value={lineStartEnding} onChange={(v) => setLineStartEnding(v as LineEnding)} options={endingOpts} />
                        <Select label={t.editor.lineEnd} value={lineEndEnding} onChange={(v) => setLineEndEnding(v as LineEnding)} options={endingOpts} />
                    </div>
                ) : null}

                {/* ── CANVAS ── */}
                {canvasError ? <Alert severity="error" style={{ position: 'absolute', top: 12, right: 12, zIndex: 20 }}>{canvasError}</Alert> : null}

                <div
                    ref={canvasRef}
                    className={`${styles.Canvas} ${isDrawing ? styles.Canvas_drawing : ''} ${tool === 'eraser' ? styles.Canvas_eraser : ''} ${tool === 'pan' ? (isPanning ? styles.Canvas_grabbing : styles.Canvas_pan) : ''} ${pendingPlacement ? styles.Canvas_placing : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    onPointerDown={onCanvasPointerDown}
                    onPointerMove={onCanvasPointerMove}
                    onPointerUp={onCanvasPointerUp}
                    onClick={(e) => {
                        if (pendingPlacement) {
                            const pt = getCanvasPoint(e.clientX, e.clientY);
                            placePendingElements(pt.x, pt.y);
                        }
                        // Selection is cleared on empty-canvas pointerdown (see
                        // onCanvasPointerDown). Doing it here too would wipe a marquee
                        // selection that pointerup just made (the click fires after).
                    }}
                >
                    <div ref={canvasContentRef} className={styles.CanvasContent} style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
                        <svg className={styles.CanvasSvg} width="100000" height="100000">
                            <SvgDefs snapToGrid={snapToGrid} />
                            {snapToGrid ? <rect width="100000" height="100000" fill="url(#grid-dots)" style={{ pointerEvents: 'none' }} /> : null}

                            {elements.filter(isLine).map((line) => {
                                const c = resolveLineCoords(line, blockMap);
                                const isSelLine = selectedLineId === line.id;
                                return (
                                    <g key={line.id} transform={line.rotation ? `rotate(${line.rotation} ${(c.x1 + c.x2) / 2} ${(c.y1 + c.y2) / 2})` : undefined}>
                                        {/* invisible wider hit area */}
                                        <line data-line="true" x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                                            stroke="transparent" strokeWidth="12"
                                            style={{ cursor: tool === 'select' ? 'move' : tool === 'eraser' ? 'pointer' : 'default', pointerEvents: 'stroke' }}
                                            onPointerDown={(e) => onLinePointerDown(e, line)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (tool === 'eraser') { pushHistory(); removeEl(line.id); }
                                            }}
                                        />
                                        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                                            stroke={line.strokeColor ?? 'var(--text-color)'}
                                            strokeWidth={isSelLine ? (line.strokeWidth ?? 2) + 1 : (line.strokeWidth ?? 2)}
                                            strokeDasharray={dashArray(line.style)}
                                            markerEnd={mEnd(line.endEnding)} markerStart={mStart(line.startEnding)}
                                            style={{ pointerEvents: 'none', ...(isSelLine ? { filter: 'drop-shadow(0 0 3px var(--primary))' } : {}) }}
                                        />
                                        {isSelLine && tool === 'select' && canEdit ? (
                                            <>
                                                <circle cx={c.x1} cy={c.y1} r={4}
                                                    fill="var(--surface)" stroke="var(--primary)" strokeWidth={1.5}
                                                    style={{ cursor: 'grab', pointerEvents: 'all' }}
                                                    onPointerDown={(e) => onLineEndpointPointerDown(e, line, 'start')}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <circle cx={c.x2} cy={c.y2} r={4}
                                                    fill="var(--surface)" stroke="var(--primary)" strokeWidth={1.5}
                                                    style={{ cursor: 'grab', pointerEvents: 'all' }}
                                                    onPointerDown={(e) => onLineEndpointPointerDown(e, line, 'end')}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </>
                                        ) : null}
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

                        {groups.map((g) => {
                            const memberSet = new Set(g.blockIds);
                            const blockMembers = elements.filter(isBlock).filter((b) => memberSet.has(b.id));
                            const lineMembers = elements.filter(isLine).filter((l) => memberSet.has(l.id));
                            const pencilMembers = elements.filter(isPencil).filter((p) => memberSet.has(p.id));
                            if (blockMembers.length + lineMembers.length + pencilMembers.length < 2) return null;
                            const xs: number[] = [], ys: number[] = [];
                            blockMembers.forEach((b) => { xs.push(b.x, b.x + b.width); ys.push(b.y, b.y + b.height); });
                            lineMembers.forEach((l) => { const c = resolveLineCoords(l, blockMap); xs.push(c.x1, c.x2); ys.push(c.y1, c.y2); });
                            pencilMembers.forEach((p) => p.points.forEach(([px, py]) => { xs.push(px); ys.push(py); }));
                            if (!xs.length) return null;
                            const minX = Math.min(...xs);
                            const minY = Math.min(...ys);
                            const maxX = Math.max(...xs);
                            const maxY = Math.max(...ys);
                            const PAD = 8;
                            const isGroupSelected = g.blockIds.some((id) => selectedIds.has(id));
                            return (
                                <div
                                    key={g.id}
                                    style={{
                                        position: 'absolute',
                                        left: minX - PAD,
                                        top: minY - PAD,
                                        width: maxX - minX + PAD * 2,
                                        height: maxY - minY + PAD * 2,
                                        border: `1.5px dashed ${isGroupSelected ? 'var(--primary, #1a56db)' : 'var(--border, #c0cfe0)'}`,
                                        borderRadius: 6,
                                        pointerEvents: 'none',
                                        opacity: 0.7,
                                    }}
                                />
                            );
                        })}

                        {elements.filter(isBlock).map((block) => {
                            const isEditing = editing?.id === block.id;
                            const isShape = isShapeBlockType(block.type);
                            const isBpmn = isBpmnBlockType(block.type);
                            const isEr = isErBlockType(block.type);
                            const isMockup = isMockupBlockType(block.type);
                            const isImage = block.type === 'image';
                            const isText = isTextBlock(block);
                            const isSelected = selectedIds.has(block.id);
                            const showAnchors = (tool === 'line' || draggingLineEnd) && !isEditing;

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
                                        isImage ? styles.Block_image : '',
                                        isSelected && !isEditing ? styles.Block_selected : '',
                                        isEditing && isText ? styles.Block_editing : '',
                                    ].filter(Boolean).join(' ')}
                                    style={{
                                        left: block.x, top: block.y, width: block.width, height: block.height,
                                        cursor: tool === 'eraser' ? 'pointer' : undefined,
                                        ...(block.rotation ? { transform: `rotate(${block.rotation}deg)` } : {}),
                                        ...(block.fillColor ? { '--block-fill': block.fillColor } as React.CSSProperties : {}),
                                        ...(block.strokeColor ? { '--block-stroke': block.strokeColor } as React.CSSProperties : {}),
                                        ...(block.strokeWidth ? { '--block-stroke-width': `${block.strokeWidth}px` } as React.CSSProperties : {}),
                                        ...(block.fontSize ? { '--block-font-size': `${block.fontSize}px` } as React.CSSProperties : {}),
                                        ...(block.fontWeight ? { '--block-font-weight': block.fontWeight } as React.CSSProperties : {}),
                                        ...(block.fontStyle ? { '--block-font-style': block.fontStyle } as React.CSSProperties : {}),
                                        ...(block.textColor ? { '--block-text-color': block.textColor } as React.CSSProperties : {}),
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
                                                onKeyDown={(e) => { if (e.key === 'Escape') cancelEditing(); }}
                                            />
                                        ) : (
                                            <div className={styles.BlockEditForm}
                                                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) commitEdit(); }}
                                            >
                                                <input className={styles.BlockEditTitle} value={editing.title} autoFocus
                                                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setEditing(null); }}
                                                />
                                                {!isShape && !isBpmn && !isEr && !isMockup ? (
                                                    <textarea className={styles.BlockEditBody} value={editing.body}
                                                        onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                                                        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                                                    />
                                                ) : null}
                                            </div>
                                        )
                                    ) : isImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img className={styles.ImageBlockContent} src={block.src} alt={block.title || ''} draggable={false} />
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
                                        <MockupBlockContent
                                            block={block}
                                            interactive={canEdit && tool === 'select' && !isEditing}
                                            onToggle={() => { pushHistory(); updateEl(block.id, { checked: !block.checked }); }}
                                        />
                                    ) : isShape ? (
                                        <div className={styles.BlockShapeContent}>
                                            {block.type === 'diamond' ? (
                                                <svg className={styles.ShapeSvg} viewBox="0 0 100 70" preserveAspectRatio="none">
                                                    <polygon points="50,2 98,35 50,68 2,35" fill={block.fillColor ?? 'none'} stroke={block.strokeColor ?? 'currentColor'} strokeWidth={block.strokeWidth ?? 2.5} />
                                                </svg>
                                            ) : block.type === 'triangle' ? (
                                                <svg className={styles.ShapeSvg} viewBox="0 0 100 80" preserveAspectRatio="none">
                                                    <polygon points="50,2 98,78 2,78" fill={block.fillColor ?? 'none'} stroke={block.strokeColor ?? 'currentColor'} strokeWidth={block.strokeWidth ?? 2.5} />
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

                    {/* ── PENDING PLACEMENT GHOST (screen coords: canvas coords × zoom + pan) ── */}
                    {pendingPlacement ? pendingPlacement.filter(isBlock).map((b) => (
                        <div
                            key={b.id}
                            className={`${styles.Block} ${styles[`Block_${b.type}`]}`}
                            style={{
                                position: 'absolute',
                                left: (pendingCursorPos.x + b.x) * zoom + panX,
                                top: (pendingCursorPos.y + b.y) * zoom + panY,
                                width: b.width * zoom,
                                height: b.height * zoom,
                                opacity: 0.45,
                                pointerEvents: 'none',
                            }}
                        />
                    )) : null}

                    {/* ── MINIMAP ── */}
                    <RemoteCursors cursors={remoteCursors} zoom={zoom} panX={panX} panY={panY} />

                    {minimapBounds && elements.length > 0 ? (() => {
                        const sw = minimapBounds.width / MINI_W * 2;
                        const vpX = canvasSize.w > 0 ? -panX / zoom : null;
                        const vpY = canvasSize.h > 0 ? -panY / zoom : null;
                        const vpW = canvasSize.w / zoom;
                        const vpH = canvasSize.h / zoom;
                        return (
                            <div className={styles.Minimap} title={t.editor.minimap}>
                                <svg width={MINI_W} height={MINI_H}
                                    viewBox={`${minimapBounds.x} ${minimapBounds.y} ${minimapBounds.width} ${minimapBounds.height}`}
                                    style={{ width: MINI_W, height: MINI_H }}
                                >
                                    {elements.filter(isBlock).map((b) => {
                                        const { x, y, width: bw, height: bh } = b;
                                        const fill = b.fillColor ?? '#eff6ff';
                                        const stroke = b.strokeColor ?? '#3b82f6';
                                        const cx = x + bw / 2, cy = y + bh / 2;
                                        if (b.type === 'text') return <text key={b.id} x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={b.fontSize ?? 14} fill={stroke} opacity={0.8}>{b.title}</text>;
                                        if (b.type === 'image') return b.src ? <image key={b.id} href={b.src} x={x} y={y} width={bw} height={bh} opacity={0.8} preserveAspectRatio="xMidYMid meet" /> : <rect key={b.id} x={x} y={y} width={bw} height={bh} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={sw} rx={4} opacity={0.8} />;
                                        if (b.type === 'circle' || b.type === 'er-attribute') return <ellipse key={b.id} cx={cx} cy={cy} rx={bw / 2} ry={bh / 2} fill={fill} stroke={stroke} strokeWidth={sw} opacity={0.8} />;
                                        if (b.type === 'bpmn-event') return <circle key={b.id} cx={cx} cy={cy} r={Math.min(bw, bh) / 2 - 1} fill={fill} stroke="#22c55e" strokeWidth={sw} opacity={0.8} />;
                                        if (b.type === 'bpmn-end') return <circle key={b.id} cx={cx} cy={cy} r={Math.min(bw, bh) / 2 - 1} fill={fill} stroke="#ef4444" strokeWidth={sw * 2} opacity={0.8} />;
                                        if (b.type === 'diamond' || b.type === 'er-relation' || b.type === 'bpmn-gateway') return <polygon key={b.id} points={`${cx},${y} ${x + bw},${cy} ${cx},${y + bh} ${x},${cy}`} fill={fill} stroke={stroke} strokeWidth={sw} opacity={0.8} />;
                                        if (b.type === 'triangle') return <polygon key={b.id} points={`${cx},${y} ${x + bw},${y + bh} ${x},${y + bh}`} fill={fill} stroke="#22c55e" strokeWidth={sw} opacity={0.8} />;
                                        if (b.type === 'sticky' || b.type === 'comment') return <rect key={b.id} x={x} y={y} width={bw} height={bh} fill={b.fillColor ?? '#fef9c3'} stroke={b.strokeColor ?? '#eab308'} strokeWidth={sw} rx={4} opacity={0.8} />;
                                        return <rect key={b.id} x={x} y={y} width={bw} height={bh} fill={fill} stroke={stroke} strokeWidth={sw} rx={4} opacity={0.8} />;
                                    })}
                                    {elements.filter(isLine).map((l) => {
                                        const c = resolveLineCoords(l, blockMap);
                                        return <line key={l.id} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#64748b" strokeWidth={sw} opacity={0.7} />;
                                    })}
                                    {vpX !== null && vpY !== null ? (
                                        <rect x={vpX} y={vpY} width={vpW} height={vpH}
                                            fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={sw * 1.5} rx={sw * 2}
                                        />
                                    ) : null}
                                </svg>
                            </div>
                        );
                    })() : null}
                </div>

                {/* ── PROPERTIES PANEL ── */}
                {canEdit ? (
                    <div className={styles.PropertiesPanel}>
                        <Typography variant="subtitle2" className={styles.PanelTitle}>{t.editor.toolProps}</Typography>
                        {selectedBlock ? (
                            <>
                                {selectedBlock.type !== 'image' ? (
                                <>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsFill}</label>
                                    <input type="color" className={styles.ColorInput}
                                        value={selectedBlock.fillColor ?? '#ffffff'}
                                        onChange={(e) => { pushHistory(); updateEl(selectedBlock.id, { fillColor: e.target.value }); }}
                                    />
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsStrokeColor}</label>
                                    <input type="color" className={styles.ColorInput}
                                        value={selectedBlock.strokeColor ?? defaultStrokeColor(selectedBlock.type)}
                                        onChange={(e) => { pushHistory(); updateEl(selectedBlock.id, { strokeColor: e.target.value }); }}
                                    />
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsStrokeWidth}</label>
                                    <input type="range" min="1" max="6" step="1"
                                        value={selectedBlock.strokeWidth ?? 2}
                                        onChange={(e) => updateEl(selectedBlock.id, { strokeWidth: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedBlock.strokeWidth ?? 2}px</span>
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsFontSize}</label>
                                    <input type="range" min="10" max="36" step="1"
                                        value={selectedBlock.fontSize ?? 13}
                                        onChange={(e) => updateEl(selectedBlock.id, { fontSize: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedBlock.fontSize ?? 13}px</span>
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsTextColor}</label>
                                    <input type="color" className={styles.ColorInput}
                                        value={selectedBlock.textColor ?? '#000000'}
                                        onChange={(e) => { pushHistory(); updateEl(selectedBlock.id, { textColor: e.target.value }); }}
                                    />
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsStyle}</label>
                                    <button type="button"
                                        className={`${styles.FmtBtn}${selectedBlock.fontWeight === 'bold' ? ` ${styles.FmtBtn_on}` : ''}`}
                                        onClick={() => { pushHistory(); updateEl(selectedBlock.id, { fontWeight: selectedBlock.fontWeight === 'bold' ? 'normal' : 'bold' }); }}
                                    ><b>B</b></button>
                                    <button type="button"
                                        className={`${styles.FmtBtn}${selectedBlock.fontStyle === 'italic' ? ` ${styles.FmtBtn_on}` : ''}`}
                                        onClick={() => { pushHistory(); updateEl(selectedBlock.id, { fontStyle: selectedBlock.fontStyle === 'italic' ? 'normal' : 'italic' }); }}
                                    ><i>I</i></button>
                                </div>
                                </>
                                ) : null}
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsRotation}</label>
                                    <input type="range" min="0" max="360" step="1"
                                        value={selectedBlock.rotation ?? 0}
                                        onChange={(e) => updateEl(selectedBlock.id, { rotation: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedBlock.rotation ?? 0}°</span>
                                </div>
                            </>
                        ) : selectedLine ? (
                            <>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsLineColor}</label>
                                    <input type="color" className={styles.ColorInput}
                                        value={selectedLine.strokeColor ?? '#000000'}
                                        onChange={(e) => { pushHistory(); updateLine(selectedLine.id, { strokeColor: e.target.value }); }}
                                    />
                                </div>
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsLineWidth}</label>
                                    <input type="range" min="1" max="8" step="1"
                                        value={selectedLine.strokeWidth ?? 2}
                                        onChange={(e) => updateLine(selectedLine.id, { strokeWidth: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedLine.strokeWidth ?? 2}px</span>
                                </div>
                                <Select label={t.editor.lineStyle} value={selectedLine.style} onChange={(v) => { pushHistory(); updateLine(selectedLine.id, { style: v as LineStyle }); }} options={lineStyleOpts} />
                                <Select label={t.editor.lineStart} value={selectedLine.startEnding} onChange={(v) => { pushHistory(); updateLine(selectedLine.id, { startEnding: v as LineEnding }); }} options={endingOpts} />
                                <Select label={t.editor.lineEnd} value={selectedLine.endEnding} onChange={(v) => { pushHistory(); updateLine(selectedLine.id, { endEnding: v as LineEnding }); }} options={endingOpts} />
                                <div className={styles.PropRow}>
                                    <label className={styles.PropLabel}>{t.editor.propsRotation}</label>
                                    <input type="range" min="0" max="360" step="1"
                                        value={selectedLine.rotation ?? 0}
                                        onChange={(e) => updateLine(selectedLine.id, { rotation: Number(e.target.value) })}
                                        onPointerUp={() => pushHistory()}
                                        style={{ flex: 1 }}
                                    />
                                    <span className={styles.PropValue}>{selectedLine.rotation ?? 0}°</span>
                                </div>
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary" style={{ marginTop: 8 }}>
                                {t.editor.propsNoSelection}
                            </Typography>
                        )}
                    </div>
                ) : null}

                {canEdit && selectedIds.size >= 2 ? (
                    <div className={styles.AlignBar}>
                        <button type="button" className={styles.AlignBtn} title={t.editor.alignLeft} onClick={() => alignBlocks('left')}><AlignHorizontalLeftOutlinedIcon fontSize="small" /></button>
                        <button type="button" className={styles.AlignBtn} title={t.editor.alignCenterH} onClick={() => alignBlocks('center-h')}><AlignHorizontalCenterOutlinedIcon fontSize="small" /></button>
                        <button type="button" className={styles.AlignBtn} title={t.editor.alignRight} onClick={() => alignBlocks('right')}><AlignHorizontalRightOutlinedIcon fontSize="small" /></button>
                        <div className={styles.AlignBarDivider} />
                        <button type="button" className={styles.AlignBtn} title={t.editor.alignTop} onClick={() => alignBlocks('top')}><AlignVerticalTopOutlinedIcon fontSize="small" /></button>
                        <button type="button" className={styles.AlignBtn} title={t.editor.alignCenterV} onClick={() => alignBlocks('center-v')}><AlignVerticalCenterOutlinedIcon fontSize="small" /></button>
                        <button type="button" className={styles.AlignBtn} title={t.editor.alignBottom} onClick={() => alignBlocks('bottom')}><AlignVerticalBottomOutlinedIcon fontSize="small" /></button>
                        {selectedIds.size >= 3 ? (
                            <>
                                <div className={styles.AlignBarDivider} />
                                <button type="button" className={styles.AlignBtn} title={t.editor.distributeH} onClick={() => distributeBlocks('h')} style={{ fontSize: 13 }}>⇔</button>
                                <button type="button" className={styles.AlignBtn} title={t.editor.distributeV} onClick={() => distributeBlocks('v')} style={{ fontSize: 13 }}>⇕</button>
                            </>
                        ) : null}
                        <div className={styles.AlignBarDivider} />
                        <button type="button" className={styles.AlignBtn} title={t.editor.group} onClick={groupSelected} style={{ fontSize: 15 }}>⊞</button>
                        {groups.some((g) => g.blockIds.some((id) => selectedIds.has(id))) ? (
                            <button type="button" className={styles.AlignBtn} title={t.editor.ungroup} onClick={ungroupSelected} style={{ fontSize: 15 }}>⊟</button>
                        ) : null}
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

function MockupBlockContent({ block, interactive, onToggle }: { block: DiagramCanvasBlock; interactive?: boolean; onToggle?: () => void }) {
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
        const checked = !!block.checked;
        return (
            <div className={styles.MockupCheckbox}>
                <span
                    className={`${styles.MockupCheckboxBox} ${checked ? styles.MockupCheckboxBox_checked : ''}`}
                    role="checkbox"
                    aria-checked={checked}
                    style={interactive ? { cursor: 'pointer' } : undefined}
                    onPointerDown={interactive ? (e) => e.stopPropagation() : undefined}
                    onClick={interactive ? (e) => { e.stopPropagation(); onToggle?.(); } : undefined}
                >
                    {checked ? '✓' : ''}
                </span>
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
    isPublic?: boolean;
};

export function DiagramEditorLoader(props: DiagramEditorLoaderProps) {
    const { diagramId, diagramName, currentUserRole, isPublic } = props;
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
            isPublic={isPublic}
        />
    );
}
