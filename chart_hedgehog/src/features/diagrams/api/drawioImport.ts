import type {
    AnchorSide,
    DiagramBlockType,
    DiagramCanvasBlock,
    DiagramElement,
    DiagramLineElement,
} from './diagramEditor';

// ── helpers ────────────────────────────────────────────────────────────────────

function did(prefix: string): string {
    return `dio-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Распаковывает содержимое <diagram> из draw.io: base64 → raw-deflate → URL-decode.
 * Использует нативный DecompressionStream (доступен в современных браузерах).
 */
async function inflateRaw(base64: string): Promise<string> {
    const binary = atob(base64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
    const text = await new Response(stream).text();
    return decodeURIComponent(text);
}

function stripHtml(value: string): string {
    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .trim();
}

function styleToType(style: string): DiagramBlockType {
    if (/ellipse/i.test(style)) return 'circle';
    if (/rhombus/i.test(style)) return 'diamond';
    if (/triangle/i.test(style)) return 'triangle';
    return 'rectangle';
}

/** Выбирает стороны привязки линии по взаимному расположению блоков. */
function anchorsFor(
    a: DiagramCanvasBlock,
    b: DiagramCanvasBlock,
): [AnchorSide, AnchorSide] {
    const dx = b.x + b.width / 2 - (a.x + a.width / 2);
    const dy = b.y + b.height / 2 - (a.y + a.height / 2);
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
    }
    return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

/** Достаёт один или несколько mxGraphModel-XML из текста файла draw.io. */
async function extractMxGraphXml(text: string): Promise<string[]> {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) {
        throw new Error('Не удалось разобрать файл draw.io');
    }

    if (doc.documentElement.nodeName === 'mxGraphModel') {
        return [text];
    }

    const diagrams = Array.from(doc.querySelectorAll('diagram'));
    if (diagrams.length === 0) {
        throw new Error('Файл не похож на экспорт draw.io');
    }

    const result: string[] = [];
    for (const diagram of diagrams) {
        const inline = diagram.querySelector('mxGraphModel');
        if (inline) {
            result.push(new XMLSerializer().serializeToString(inline));
            continue;
        }
        const content = (diagram.textContent ?? '').trim();
        if (!content) continue;
        result.push(content.startsWith('<') ? content : await inflateRaw(content));
    }
    return result;
}

// ── public API ──────────────────────────────────────────────────────────────────

/**
 * Парсит файл draw.io (.drawio / .xml) в элементы холста ChartHedgehog.
 * Поддерживает как несжатый mxGraphModel, так и сжатый (deflate-raw) формат.
 */
export async function parseDrawioToElements(text: string): Promise<DiagramElement[]> {
    const xmls = await extractMxGraphXml(text);
    const elements: DiagramElement[] = [];

    for (const xml of xmls) {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const cells = Array.from(doc.querySelectorAll('mxCell'));
        const blockByMxId = new Map<string, DiagramCanvasBlock>();

        // вершины → блоки
        for (const cell of cells) {
            if (cell.getAttribute('vertex') !== '1') continue;
            const geo = cell.querySelector('mxGeometry');
            if (!geo) continue;

            const block: DiagramCanvasBlock = {
                id: did('v'),
                type: styleToType(cell.getAttribute('style') ?? ''),
                title: stripHtml(cell.getAttribute('value') ?? ''),
                body: '',
                x: Math.round(parseFloat(geo.getAttribute('x') ?? '0')),
                y: Math.round(parseFloat(geo.getAttribute('y') ?? '0')),
                width: Math.round(parseFloat(geo.getAttribute('width') ?? '120')),
                height: Math.round(parseFloat(geo.getAttribute('height') ?? '60')),
            };

            const mxId = cell.getAttribute('id');
            if (mxId) blockByMxId.set(mxId, block);
            elements.push(block);
        }

        // рёбра → линии
        for (const cell of cells) {
            if (cell.getAttribute('edge') !== '1') continue;

            const src = blockByMxId.get(cell.getAttribute('source') ?? '');
            const tgt = blockByMxId.get(cell.getAttribute('target') ?? '');

            const line: DiagramLineElement = {
                id: did('e'),
                kind: 'line',
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
                style: 'solid',
                startEnding: 'none',
                endEnding: 'arrow',
            };

            if (src && tgt) {
                const [fromAnchor, toAnchor] = anchorsFor(src, tgt);
                line.fromBlockId = src.id;
                line.fromAnchor = fromAnchor;
                line.toBlockId = tgt.id;
                line.toAnchor = toAnchor;
                elements.push(line);
                continue;
            }

            // нет связей с блоками — пробуем явные координаты
            const geo = cell.querySelector('mxGeometry');
            const sp = geo?.querySelector('mxPoint[as="sourcePoint"]');
            const tp = geo?.querySelector('mxPoint[as="targetPoint"]');
            if (sp && tp) {
                line.x1 = parseFloat(sp.getAttribute('x') ?? '0');
                line.y1 = parseFloat(sp.getAttribute('y') ?? '0');
                line.x2 = parseFloat(tp.getAttribute('x') ?? '0');
                line.y2 = parseFloat(tp.getAttribute('y') ?? '0');
                elements.push(line);
            }
        }
    }

    if (elements.length === 0) {
        throw new Error('В файле draw.io не найдено элементов');
    }
    return elements;
}
