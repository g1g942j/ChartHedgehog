import { apiFetch } from '@/shared/api/client';
import { getSessionUser } from '@/shared/auth/session';

import type { AssignableRole } from '../constants/roles';
import { fetchDiagramEntity } from './diagramDetail';
import { getDiagramById, updateStoredDiagram } from './diagrams';
import { buildParticipantsList } from './mappers';

export type DiagramParticipant = {
    userId: number;
    username: string;
    email: string;
    fullName?: string | null;
    role: string;
};

export type ParticipantUserOption = {
    userId: number;
    username: string;
    email: string;
    fullName?: string | null;
};

export async function searchParticipantUsers(
    query: string,
    diagramId: number,
): Promise<ParticipantUserOption[]> {
    const normalized = query.trim();
    if (normalized.length < 2) {
        return [];
    }

    const diagram = getDiagramById(diagramId);
    const excludedIds = new Set<number>([
        diagram?.ownerId ?? 0,
        ...(diagram?.participantRoles.map((p) => p.userId) ?? []),
    ]);
    const currentUser = getSessionUser();
    if (currentUser) {
        excludedIds.add(currentUser.id);
    }

    type UserSearchResult = {
        userId: number;
        username: string;
        email: string;
        fullName?: string | null;
    };

    const results = await apiFetch<UserSearchResult[]>(
        `/api/users/search?q=${encodeURIComponent(normalized)}`,
    );

    return results.filter((user) => !excludedIds.has(user.userId));
}

export async function fetchDiagramParticipants(
    diagramId: number,
    currentUsername?: string,
): Promise<DiagramParticipant[]> {
    const diagram = await fetchDiagramEntity(diagramId);

    if (currentUsername) {
        const isOwner = diagram.owner?.username === currentUsername;
        const participantRole = diagram.participantRoles?.find(
            (entry) => entry.user?.username === currentUsername,
        )?.role;

        if (!isOwner && participantRole !== 'EDITOR') {
            throw new Error('Недостаточно прав для просмотра участников');
        }
    }

    return buildParticipantsList(diagram);
}

export async function addDiagramParticipant(
    diagramId: number,
    user: ParticipantUserOption,
    role: AssignableRole,
): Promise<void> {
    const stored = getDiagramById(diagramId);
    if (!stored) {
        throw new Error('Диаграмма не найдена');
    }

    if (!user.username.trim() || !user.email.trim()) {
        throw new Error('Введите логин или email пользователя');
    }

    const ownerMatches =
        stored.ownerUsername.toLowerCase() === user.username.toLowerCase() ||
        `${stored.ownerUsername}@local.dev`.toLowerCase() ===
            user.email.toLowerCase();
    const exists = stored.participantRoles.some(
        (p) =>
            p.userId === user.userId ||
            p.username.toLowerCase() === user.username.toLowerCase() ||
            p.email.toLowerCase() === user.email.toLowerCase(),
    );
    if (exists || ownerMatches) {
        throw new Error('Пользователь уже в диаграмме');
    }

    stored.participantRoles.push({
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role,
    });
    stored.updatedAt = new Date().toISOString();

    updateStoredDiagram(stored);
}

export async function updateDiagramParticipantRole(
    diagramId: number,
    userId: number,
    role: string,
): Promise<void> {
    const currentUser = getSessionUser();
    const stored = getDiagramById(diagramId);
    if (!stored) {
        throw new Error('Диаграмма не найдена');
    }

    if (role === 'OWNER') {
        if (!currentUser || stored.ownerId !== currentUser.id) {
            throw new Error('Только владелец может передать права');
        }

        const participant = stored.participantRoles.find((p) => p.userId === userId);
        if (!participant) {
            throw new Error('Участник не найден');
        }

        // Текущий владелец становится редактором
        stored.participantRoles = stored.participantRoles.filter((p) => p.userId !== userId);
        stored.participantRoles.push({
            userId: stored.ownerId,
            username: currentUser.username,
            email: currentUser.email,
            fullName: currentUser.fullName,
            role: 'EDITOR',
        });

        stored.ownerId = userId;
        stored.ownerUsername = participant.username;
        stored.updatedAt = new Date().toISOString();
        updateStoredDiagram(stored);
        return;
    }

    if (!currentUser || stored.ownerId !== currentUser.id) {
        throw new Error('Только владелец может изменять роли участников');
    }

    if (stored.ownerId === userId) {
        throw new Error('Нельзя изменить роль владельца');
    }

    const participant = stored.participantRoles.find((p) => p.userId === userId);
    if (!participant) {
        throw new Error('Участник не найден');
    }

    participant.role = role;
    stored.updatedAt = new Date().toISOString();

    updateStoredDiagram(stored);
}

export async function removeDiagramParticipant(
    diagramId: number,
    userId: number,
): Promise<void> {
    const stored = getDiagramById(diagramId);
    if (!stored) {
        throw new Error('Диаграмма не найдена');
    }

    if (stored.ownerId === userId) {
        throw new Error('Нельзя удалить владельца диаграммы');
    }

    stored.participantRoles = stored.participantRoles.filter(
        (p) => p.userId !== userId,
    );
    stored.updatedAt = new Date().toISOString();

    updateStoredDiagram(stored);
}
