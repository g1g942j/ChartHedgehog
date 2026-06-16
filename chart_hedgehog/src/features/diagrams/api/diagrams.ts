import { apiFetch } from '@/shared/api/client';
import {
    getSessionUser,
    getStoredDiagrams,
    saveStoredDiagrams,
    type StoredDiagram,
} from '@/shared/auth/session';

import { mapDiagramToSummary, userHasAccess } from './mappers';
import type { ApiDiagram } from './types';

export type DiagramSummary = {
    id: number;
    name: string;
    description?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    ownerUsername: string;
    role: string;
};

// function toApiDiagram(stored: StoredDiagram): ApiDiagram {
//     return {
//         id: stored.id,
//         name: stored.name,
//         description: stored.description,
//         createdAt: stored.createdAt,
//         updatedAt: stored.updatedAt,
//         template: stored.template,
//         content: stored.content,
//         owner: {
//             id: stored.ownerId,
//             username: stored.ownerUsername,
//             email: `${stored.ownerUsername}@local.dev`,
//             fullName: stored.ownerUsername,
//         },
//         participants: stored.participantRoles.map((p) => ({
//             id: p.userId,
//             username: p.username,
//             email: p.email,
//             fullName: p.fullName,
//         })),
//         participantRoles: stored.participantRoles.map((p) => ({
//             user: {
//                 id: p.userId,
//                 username: p.username,
//                 email: p.email,
//                 fullName: p.fullName,
//             },
//             role: p.role,
//         })),
//     };
// }

export async function fetchMyDiagrams(
    currentUsername?: string,
): Promise<DiagramSummary[]> {
    const diagrams = await apiFetch<ApiDiagram[]>('/api/diagrams');

    return diagrams
        .filter((diagram) => userHasAccess(diagram, currentUsername))
        .map((diagram) => mapDiagramToSummary(diagram, currentUsername));
}

export async function createDiagram(name: string): Promise<DiagramSummary> {
    const user = getSessionUser();
    if (!user) {
        throw new Error('Не авторизован');
    }

    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('Введите название диаграммы');
    }

    const diagram = await apiFetch<ApiDiagram>(
        `/api/diagrams?name=${encodeURIComponent(trimmed)}`,
        { method: 'POST' },
    );
    return mapDiagramToSummary(diagram, diagram.owner?.username);
}

export async function updateDiagramName(
    id: number,
    name: string,
): Promise<DiagramSummary> {
    const user = getSessionUser();
    if (!user) {
        throw new Error('Не авторизован');
    }

    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('Введите название диаграммы');
    }

    // const diagram = getDiagramById(id);
    // if (!diagram) {
    //     throw new Error('Диаграмма не найдена');
    // }

    // if (diagram.ownerUsername !== user.username) {
    //     throw new Error('Недостаточно прав');
    // }

    const result = await apiFetch<ApiDiagram>(`/api/diagrams/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
    });

    return mapDiagramToSummary(result, result.owner?.username);
}

export async function deleteDiagram(id: number): Promise<void> {
    const user = getSessionUser();
    if (!user) {
        throw new Error('Не авторизован');
    }

    // const diagram = getDiagramById(id);
    // if (!diagram) {
    //     throw new Error('Диаграмма не найдена');
    // }

    // if (diagram.ownerUsername !== user.username) {
    //     throw new Error('Недостаточно прав');
    // }

    await apiFetch<void>(`/api/diagrams/${id}`, { method: 'DELETE' });
    // saveStoredDiagrams(getStoredDiagrams().filter((d) => d.id !== id));
}

export function getDiagramById(id: number): StoredDiagram | null {
    return getStoredDiagrams().find((d) => d.id === id) ?? null;
}

export function updateStoredDiagram(diagram: StoredDiagram): void {
    const diagrams = getStoredDiagrams().map((d) =>
        d.id === diagram.id ? diagram : d,
    );
    saveStoredDiagrams(diagrams);
}
