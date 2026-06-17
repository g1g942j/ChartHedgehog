import { getSessionUser } from '@/shared/auth/session';

import { getDiagramById, updateStoredDiagram } from './diagrams';

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

export type DiagramBlockType =
    | 'class'
    | 'interface'
    | 'enum'
    | 'actor'
    | 'note'
    | 'rectangle'
    | 'circle'
    | 'diamond'
    | 'triangle'
    | 'sticky'
    | 'text'
    | 'comment'
    | 'bpmn-task'
    | 'bpmn-gateway'
    | 'bpmn-event'
    | 'bpmn-end'
    | 'er-entity'
    | 'er-relation'
    | 'er-attribute'
    | 'mockup-button'
    | 'mockup-input'
    | 'mockup-checkbox'
    | 'mockup-card'
    | 'image';

export const SHAPE_BLOCK_TYPES: DiagramBlockType[] = [
    'rectangle',
    'circle',
    'diamond',
    'triangle',
    'sticky',
];

export const BPMN_BLOCK_TYPES: DiagramBlockType[] = [
    'bpmn-task',
    'bpmn-gateway',
    'bpmn-event',
    'bpmn-end',
];

export const ER_BLOCK_TYPES: DiagramBlockType[] = [
    'er-entity',
    'er-relation',
    'er-attribute',
];

export const MOCKUP_BLOCK_TYPES: DiagramBlockType[] = [
    'mockup-button',
    'mockup-input',
    'mockup-checkbox',
    'mockup-card',
];

export function isShapeBlockType(type: DiagramBlockType): boolean {
    return SHAPE_BLOCK_TYPES.includes(type);
}
export function isBpmnBlockType(type: DiagramBlockType): boolean {
    return BPMN_BLOCK_TYPES.includes(type);
}
export function isErBlockType(type: DiagramBlockType): boolean {
    return ER_BLOCK_TYPES.includes(type);
}
export function isMockupBlockType(type: DiagramBlockType): boolean {
    return MOCKUP_BLOCK_TYPES.includes(type);
}

export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type LineEnding = 'none' | 'arrow' | 'open-arrow' | 'circle-end';

export type DiagramCanvasBlock = {
    id: string;
    type: DiagramBlockType;
    title: string;
    body: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    fontSize?: number;
    /** data URL для блоков типа 'image' */
    src?: string;
};

export type DiagramLineElement = {
    id: string;
    kind: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    style: LineStyle;
    startEnding: LineEnding;
    endEnding: LineEnding;
    fromBlockId?: string;
    fromAnchor?: AnchorSide;
    toBlockId?: string;
    toAnchor?: AnchorSide;
    strokeColor?: string;
    strokeWidth?: number;
};

export type DiagramPencilElement = {
    id: string;
    kind: 'pencil';
    points: [number, number][];
};

export type DiagramElement = DiagramCanvasBlock | DiagramLineElement | DiagramPencilElement;

export type DiagramBlockTemplate = {
    type: DiagramBlockType;
    name: string;
    title: string;
    body: string;
    width: number;
    height: number;
};

export type DiagramTemplate = {
    id: string;
    name: string;
    blocks: DiagramCanvasBlock[];
};

export type DiagramEditorState = {
    template?: string | null;
    blocks: DiagramElement[];
};

export const UML_BLOCK_TEMPLATES: DiagramBlockTemplate[] = [
    { type: 'class', name: 'Class', title: 'User', body: '+ id: Long\n+ email: String', width: 180, height: 120 },
    { type: 'interface', name: 'Interface', title: 'Repository', body: '+ findById(id): Entity', width: 190, height: 110 },
    { type: 'enum', name: 'Enum', title: 'Role', body: 'OWNER\nEDITOR\nVIEWER', width: 160, height: 120 },
    { type: 'actor', name: 'Actor', title: 'User', body: 'External user', width: 150, height: 100 },
    { type: 'note', name: 'Note', title: 'Note', body: 'Add details here', width: 180, height: 110 },
];

export const TEXT_BLOCK_TEMPLATES: DiagramBlockTemplate[] = [
    { type: 'text', name: 'Текст', title: 'Текст', body: '', width: 200, height: 60 },
    { type: 'comment', name: 'Комментарий', title: 'Комментарий', body: '', width: 220, height: 80 },
];

export const SHAPE_BLOCK_TEMPLATES: DiagramBlockTemplate[] = [
    { type: 'rectangle', name: 'Rectangle', title: 'Box', body: '', width: 160, height: 100 },
    { type: 'circle', name: 'Circle', title: 'Circle', body: '', width: 120, height: 120 },
    { type: 'diamond', name: 'Diamond', title: 'Decision', body: '', width: 160, height: 100 },
    { type: 'triangle', name: 'Triangle', title: 'Start', body: '', width: 140, height: 120 },
    { type: 'sticky', name: 'Sticky Note', title: 'Note here', body: '', width: 180, height: 140 },
];

export const BPMN_BLOCK_TEMPLATES: DiagramBlockTemplate[] = [
    { type: 'bpmn-event', name: 'Start Event', title: '', body: '', width: 48, height: 48 },
    { type: 'bpmn-task', name: 'Task', title: 'Task', body: '', width: 160, height: 80 },
    { type: 'bpmn-gateway', name: 'Gateway', title: '', body: '', width: 72, height: 72 },
    { type: 'bpmn-end', name: 'End Event', title: '', body: '', width: 48, height: 48 },
];

export const MOCKUP_BLOCK_TEMPLATES: DiagramBlockTemplate[] = [
    { type: 'mockup-button', name: 'Кнопка', title: 'Кнопка', body: '', width: 120, height: 36 },
    { type: 'mockup-input', name: 'Поле ввода', title: 'Placeholder…', body: '', width: 200, height: 36 },
    { type: 'mockup-checkbox', name: 'Чекбокс', title: 'Чекбокс', body: '', width: 140, height: 28 },
    { type: 'mockup-card', name: 'Карточка', title: 'Card', body: '', width: 220, height: 140 },
];

export const ER_BLOCK_TEMPLATES: DiagramBlockTemplate[] = [
    { type: 'er-entity', name: 'Entity', title: 'Entity', body: 'id: INT PK\nname: VARCHAR', width: 180, height: 120 },
    { type: 'er-attribute', name: 'Attribute', title: 'attribute', body: '', width: 120, height: 50 },
    { type: 'er-relation', name: 'Relation', title: 'has', body: '', width: 100, height: 60 },
];

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
    {
        id: 'uml',
        name: 'UML',
        blocks: [
            { id: 'uml-user', type: 'class', title: 'User', body: '+ id: Long\n+ username: String\n+ email: String', x: 80, y: 80, width: 210, height: 140 },
            { id: 'uml-diagram', type: 'class', title: 'Diagram', body: '+ id: Long\n+ name: String\n+ updatedAt: Date', x: 380, y: 90, width: 220, height: 140 },
            { id: 'uml-role', type: 'enum', title: 'ParticipantRole', body: 'OWNER\nEDITOR\nCOMMENTATOR\nVIEWER', x: 230, y: 300, width: 220, height: 150 },
        ],
    },
];

// ── flowchart presets ─────────────────────────────────────────────────────────

export type FlowchartPreset = {
    name: string;
    description: string;
    generate: (ox: number, oy: number) => DiagramElement[];
};

function pid(s: string): string {
    return `p-${s}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const FLOWCHART_PRESETS: FlowchartPreset[] = [
    {
        name: 'Простой процесс',
        description: 'Старт → Действие → Конец',
        generate: (ox, oy) => {
            const b1 = pid('s'), b2 = pid('a'), b3 = pid('e');
            return [
                { id: b1, type: 'actor' as DiagramBlockType, title: 'Старт', body: '', x: ox, y: oy, width: 120, height: 60 },
                { id: b2, type: 'class' as DiagramBlockType, title: 'Действие', body: '', x: ox, y: oy + 120, width: 120, height: 60 },
                { id: b3, type: 'actor' as DiagramBlockType, title: 'Конец', body: '', x: ox, y: oy + 240, width: 120, height: 60 },
                { id: pid('l1'), kind: 'line' as const, x1: ox + 60, y1: oy + 60, x2: ox + 60, y2: oy + 120, style: 'solid' as LineStyle, startEnding: 'none' as LineEnding, endEnding: 'arrow' as LineEnding },
                { id: pid('l2'), kind: 'line' as const, x1: ox + 60, y1: oy + 180, x2: ox + 60, y2: oy + 240, style: 'solid' as LineStyle, startEnding: 'none' as LineEnding, endEnding: 'arrow' as LineEnding },
            ];
        },
    },
    {
        name: 'Ветвление',
        description: 'Действие → Условие → Да / Нет',
        generate: (ox, oy) => {
            const b1 = pid('a'), b2 = pid('d'), b3 = pid('y'), b4 = pid('n');
            return [
                { id: b1, type: 'class' as DiagramBlockType, title: 'Действие', body: '', x: ox, y: oy, width: 140, height: 60 },
                { id: b2, type: 'diamond' as DiagramBlockType, title: 'Условие?', body: '', x: ox, y: oy + 120, width: 140, height: 80 },
                { id: b3, type: 'class' as DiagramBlockType, title: 'Да', body: '', x: ox - 160, y: oy + 260, width: 120, height: 60 },
                { id: b4, type: 'class' as DiagramBlockType, title: 'Нет', body: '', x: ox + 160, y: oy + 260, width: 120, height: 60 },
                { id: pid('l1'), kind: 'line' as const, x1: ox + 70, y1: oy + 60, x2: ox + 70, y2: oy + 120, style: 'solid' as LineStyle, startEnding: 'none' as LineEnding, endEnding: 'arrow' as LineEnding },
                { id: pid('l2'), kind: 'line' as const, x1: ox, y1: oy + 160, x2: ox - 100, y2: oy + 260, style: 'solid' as LineStyle, startEnding: 'none' as LineEnding, endEnding: 'arrow' as LineEnding },
                { id: pid('l3'), kind: 'line' as const, x1: ox + 140, y1: oy + 160, x2: ox + 220, y2: oy + 260, style: 'solid' as LineStyle, startEnding: 'none' as LineEnding, endEnding: 'arrow' as LineEnding },
            ];
        },
    },
    {
        name: 'BPMN-процесс',
        description: 'Старт → Задача → Конец (BPMN-стиль)',
        generate: (ox, oy) => {
            const b1 = pid('se'), b2 = pid('t'), b3 = pid('ee');
            return [
                { id: b1, type: 'bpmn-event' as DiagramBlockType, title: '', body: '', x: ox, y: oy + 20, width: 48, height: 48 },
                { id: b2, type: 'bpmn-task' as DiagramBlockType, title: 'Задача', body: '', x: ox + 90, y: oy, width: 140, height: 88 },
                { id: b3, type: 'bpmn-end' as DiagramBlockType, title: '', body: '', x: ox + 270, y: oy + 20, width: 48, height: 48 },
                { id: pid('l1'), kind: 'line' as const, x1: ox + 48, y1: oy + 44, x2: ox + 90, y2: oy + 44, style: 'solid' as LineStyle, startEnding: 'none' as LineEnding, endEnding: 'arrow' as LineEnding },
                { id: pid('l2'), kind: 'line' as const, x1: ox + 230, y1: oy + 44, x2: ox + 270, y2: oy + 44, style: 'solid' as LineStyle, startEnding: 'none' as LineEnding, endEnding: 'arrow' as LineEnding },
            ];
        },
    },
];

// ── helpers ──────────────────────────────────────────────────────────────────

export function getAnchorPoint(block: DiagramCanvasBlock, side: AnchorSide): { x: number; y: number } {
    const mx = block.x + block.width / 2;
    const my = block.y + block.height / 2;
    switch (side) {
        case 'top':    return { x: mx, y: block.y };
        case 'right':  return { x: block.x + block.width, y: my };
        case 'bottom': return { x: mx, y: block.y + block.height };
        case 'left':   return { x: block.x, y: my };
    }
}

export function resolveLineCoords(
    line: DiagramLineElement,
    blockMap: Map<string, DiagramCanvasBlock>,
): { x1: number; y1: number; x2: number; y2: number } {
    let x1 = line.x1, y1 = line.y1, x2 = line.x2, y2 = line.y2;
    if (line.fromBlockId && line.fromAnchor) {
        const b = blockMap.get(line.fromBlockId);
        if (b) { const pt = getAnchorPoint(b, line.fromAnchor); x1 = pt.x; y1 = pt.y; }
    }
    if (line.toBlockId && line.toAnchor) {
        const b = blockMap.get(line.toBlockId);
        if (b) { const pt = getAnchorPoint(b, line.toAnchor); x2 = pt.x; y2 = pt.y; }
    }
    return { x1, y1, x2, y2 };
}

// ── validation ────────────────────────────────────────────────────────────────

function isCanvasBlock(value: unknown): value is DiagramCanvasBlock {
    if (!value || typeof value !== 'object') return false;
    const block = value as Partial<DiagramCanvasBlock>;
    return (
        typeof block.id === 'string' &&
        typeof block.type === 'string' &&
        typeof block.title === 'string' &&
        typeof block.body === 'string' &&
        typeof block.x === 'number' &&
        typeof block.y === 'number' &&
        typeof block.width === 'number' &&
        typeof block.height === 'number'
    );
}

function isLineElement(value: unknown): value is DiagramLineElement {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        v.kind === 'line' &&
        typeof v.id === 'string' &&
        typeof v.x1 === 'number' &&
        typeof v.y1 === 'number' &&
        typeof v.x2 === 'number' &&
        typeof v.y2 === 'number'
    );
}

function isPencilElement(value: unknown): value is DiagramPencilElement {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return v.kind === 'pencil' && typeof v.id === 'string' && Array.isArray(v.points);
}

function isDiagramElement(value: unknown): value is DiagramElement {
    return isLineElement(value) || isPencilElement(value) || isCanvasBlock(value);
}

function parseElements(content?: string | null): DiagramElement[] {
    if (!content) return [];
    try {
        const parsed = JSON.parse(content) as unknown;
        if (Array.isArray(parsed)) return parsed.filter(isDiagramElement);
    } catch { return []; }
    return [];
}

function getCallerRole(diagramId: number): { role: string; diagram: NonNullable<ReturnType<typeof getDiagramById>> } {
    const user = getSessionUser();
    if (!user) throw new Error('Не авторизован');
    const diagram = getDiagramById(diagramId);
    if (!diagram) throw new Error('Диаграмма не найдена');
    if (diagram.ownerId === user.id) return { role: 'OWNER', diagram };
    const p = diagram.participantRoles.find((r) => r.userId === user.id);
    if (!p) throw new Error('Нет доступа к диаграмме');
    return { role: p.role, diagram };
}

export async function fetchDiagramEditorState(diagramId: number): Promise<DiagramEditorState> {
    const { diagram } = getCallerRole(diagramId);
    return { template: diagram.template, blocks: parseElements(diagram.content) };
}

function buildPreviewSvg(elements: DiagramElement[]): string {
    const blocks = elements.filter(isCanvasBlock);
    const lines = elements.filter(isLineElement);
    if (blocks.length === 0 && lines.length === 0) return '';
    const bMap = new Map(blocks.map((b) => [b.id, b]));
    const xs: number[] = [], ys: number[] = [];
    blocks.forEach((b) => { xs.push(b.x, b.x + b.width); ys.push(b.y, b.y + b.height); });
    lines.forEach((l) => { const c = resolveLineCoords(l, bMap); xs.push(c.x1, c.x2); ys.push(c.y1, c.y2); });
    const pad = 16;
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
    const w = Math.max(Math.max(...xs) + pad - minX, 1);
    const h = Math.max(Math.max(...ys) + pad - minY, 1);
    const svgLines = lines.map((l) => { const c = resolveLineCoords(l, bMap); return `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="#94a3b8" stroke-width="1.5"/>`; }).join('');
    const svgBlocks = blocks.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5" rx="4"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}">${svgLines}${svgBlocks}</svg>`;
}

export async function saveDiagramEditorState(diagramId: number, state: DiagramEditorState): Promise<void> {
    const { role, diagram } = getCallerRole(diagramId);
    if (role !== 'OWNER' && role !== 'EDITOR') throw new Error('Недостаточно прав для редактирования диаграммы');
    diagram.template = state.template;
    diagram.content = JSON.stringify(state.blocks);
    diagram.updatedAt = new Date().toISOString();
    diagram.preview = buildPreviewSvg(state.blocks);
    updateStoredDiagram(diagram);
}
