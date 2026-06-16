import { getDiagramById } from './diagrams';
import { mapDiagramToDetail, toApiDiagram, userHasAccess } from './mappers';

export type DiagramDetail = {
    id: number;
    name: string;
    description?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    ownerId: number;
    ownerUsername: string;
    currentUserRole: string;
};

export async function fetchDiagramDetail(
    id: number,
    currentUsername?: string,
): Promise<DiagramDetail> {
    const stored = getDiagramById(id);
    if (!stored) {
        throw new Error('Диаграмма не найдена');
    }

    const diagram = toApiDiagram(stored);

    if (currentUsername && !userHasAccess(diagram, currentUsername)) {
        throw new Error('Нет доступа к диаграмме');
    }

    return mapDiagramToDetail(diagram, currentUsername);
}

export async function fetchDiagramEntity(id: number) {
    const stored = getDiagramById(id);
    if (!stored) {
        throw new Error('Диаграмма не найдена');
    }

    return toApiDiagram(stored);
}
