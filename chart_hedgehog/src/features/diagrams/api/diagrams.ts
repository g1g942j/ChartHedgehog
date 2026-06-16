import {
    getSessionUser,
    getStoredDiagrams,
    nextDiagramId,
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

function toApiDiagram(stored: StoredDiagram): ApiDiagram {
    return {
        id: stored.id,
        name: stored.name,
        description: stored.description,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
        template: stored.template,
        content: stored.content,
        owner: {
            id: stored.ownerId,
            username: stored.ownerUsername,
            email: `${stored.ownerUsername}@local.dev`,
            fullName: stored.ownerUsername,
        },
        participants: stored.participantRoles.map((p) => ({
            id: p.userId,
            username: p.username,
            email: p.email,
            fullName: p.fullName,
        })),
        participantRoles: stored.participantRoles.map((p) => ({
            user: {
                id: p.userId,
                username: p.username,
                email: p.email,
                fullName: p.fullName,
            },
            role: p.role,
        })),
    };
}

export async function fetchMyDiagrams(
    currentUsername?: string,
): Promise<DiagramSummary[]> {
    const diagrams = getStoredDiagrams().map(toApiDiagram);

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

    const stored = getStoredDiagrams();
    const now = new Date().toISOString();
    const diagram: StoredDiagram = {
        id: nextDiagramId(stored),
        name: trimmed,
        description: null,
        createdAt: now,
        updatedAt: now,
        template: null,
        content: '',
        ownerUsername: user.username,
        ownerId: user.id,
        participantRoles: [],
    };

    saveStoredDiagrams([diagram, ...stored]);

    return mapDiagramToSummary(toApiDiagram(diagram), user.username);
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

    const diagram = getDiagramById(id);
    if (!diagram) {
        throw new Error('Диаграмма не найдена');
    }

    if (diagram.ownerUsername !== user.username) {
        throw new Error('Недостаточно прав');
    }

    diagram.name = trimmed;
    diagram.updatedAt = new Date().toISOString();
    updateStoredDiagram(diagram);

    return mapDiagramToSummary(toApiDiagram(diagram), user.username);
}

export async function deleteDiagram(id: number): Promise<void> {
    const user = getSessionUser();
    if (!user) {
        throw new Error('Не авторизован');
    }

    const diagram = getDiagramById(id);
    if (!diagram) {
        throw new Error('Диаграмма не найдена');
    }

    if (diagram.ownerUsername !== user.username) {
        throw new Error('Недостаточно прав');
    }

    saveStoredDiagrams(getStoredDiagrams().filter((d) => d.id !== id));
}

export async function cloneDiagram(id: number): Promise<DiagramSummary> {
    const user = getSessionUser();
    if (!user) throw new Error('Не авторизован');

    const source = getDiagramById(id);
    if (!source) throw new Error('Диаграмма не найдена');

    const stored = getStoredDiagrams();
    const now = new Date().toISOString();
    const clone: StoredDiagram = {
        ...source,
        id: nextDiagramId(stored),
        name: `${source.name} (копия)`,
        createdAt: now,
        updatedAt: now,
        ownerUsername: user.username,
        ownerId: user.id,
        participantRoles: [],
    };

    saveStoredDiagrams([clone, ...stored]);
    return mapDiagramToSummary(toApiDiagram(clone), user.username);
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
