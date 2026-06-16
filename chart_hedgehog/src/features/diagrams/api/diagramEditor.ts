import { getDiagramById, updateStoredDiagram } from './diagrams';

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
    | 'sticky';

export const SHAPE_BLOCK_TYPES: DiagramBlockType[] = [
    'rectangle',
    'circle',
    'diamond',
    'triangle',
    'sticky',
];

export function isShapeBlockType(type: DiagramBlockType): boolean {
    return SHAPE_BLOCK_TYPES.includes(type);
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
    {
        type: 'class',
        name: 'Class',
        title: 'User',
        body: '+ id: Long\n+ email: String',
        width: 180,
        height: 120,
    },
    {
        type: 'interface',
        name: 'Interface',
        title: 'Repository',
        body: '+ findById(id): Entity',
        width: 190,
        height: 110,
    },
    {
        type: 'enum',
        name: 'Enum',
        title: 'Role',
        body: 'OWNER\nEDITOR\nVIEWER',
        width: 160,
        height: 120,
    },
    {
        type: 'actor',
        name: 'Actor',
        title: 'User',
        body: 'External user',
        width: 150,
        height: 100,
    },
    {
        type: 'note',
        name: 'Note',
        title: 'Note',
        body: 'Add details here',
        width: 180,
        height: 110,
    },
];

export const SHAPE_BLOCK_TEMPLATES: DiagramBlockTemplate[] = [
    {
        type: 'rectangle',
        name: 'Rectangle',
        title: 'Box',
        body: '',
        width: 160,
        height: 100,
    },
    {
        type: 'circle',
        name: 'Circle',
        title: 'Circle',
        body: '',
        width: 120,
        height: 120,
    },
    {
        type: 'diamond',
        name: 'Diamond',
        title: 'Decision',
        body: '',
        width: 160,
        height: 100,
    },
    {
        type: 'triangle',
        name: 'Triangle',
        title: 'Start',
        body: '',
        width: 140,
        height: 120,
    },
    {
        type: 'sticky',
        name: 'Sticky Note',
        title: 'Note here',
        body: '',
        width: 180,
        height: 140,
    },
];

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
    {
        id: 'uml',
        name: 'UML',
        blocks: [
            {
                id: 'uml-user',
                type: 'class',
                title: 'User',
                body: '+ id: Long\n+ username: String\n+ email: String',
                x: 80,
                y: 80,
                width: 210,
                height: 140,
            },
            {
                id: 'uml-diagram',
                type: 'class',
                title: 'Diagram',
                body: '+ id: Long\n+ name: String\n+ updatedAt: Date',
                x: 380,
                y: 90,
                width: 220,
                height: 140,
            },
            {
                id: 'uml-role',
                type: 'enum',
                title: 'ParticipantRole',
                body: 'OWNER\nEDITOR\nCOMMENTATOR\nVIEWER',
                x: 230,
                y: 300,
                width: 220,
                height: 150,
            },
        ],
    },
];

function isCanvasBlock(value: unknown): value is DiagramCanvasBlock {
    if (!value || typeof value !== 'object') {
        return false;
    }

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
        if (Array.isArray(parsed)) {
            return parsed.filter(isDiagramElement);
        }
    } catch {
        return [];
    }
    return [];
}

export async function fetchDiagramEditorState(
    diagramId: number,
): Promise<DiagramEditorState> {
    const diagram = getDiagramById(diagramId);
    if (!diagram) {
        throw new Error('Диаграмма не найдена');
    }

    return {
        template: diagram.template,
        blocks: parseElements(diagram.content),
    };
}

export async function saveDiagramEditorState(
    diagramId: number,
    state: DiagramEditorState,
): Promise<void> {
    const diagram = getDiagramById(diagramId);
    if (!diagram) {
        throw new Error('Диаграмма не найдена');
    }

    diagram.template = state.template;
    diagram.content = JSON.stringify(state.blocks);
    diagram.updatedAt = new Date().toISOString();
    updateStoredDiagram(diagram);
}
