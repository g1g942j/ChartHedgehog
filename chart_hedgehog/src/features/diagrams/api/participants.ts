import { apiFetch } from '@/shared/api/client';

import type { AssignableRole } from '../constants/roles';

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
    if (normalized.length < 2) return [];
    return apiFetch<ParticipantUserOption[]>(
        `/api/users/search?q=${encodeURIComponent(normalized)}&diagramId=${diagramId}`,
    );
}

export async function fetchDiagramParticipants(
    diagramId: number,
): Promise<DiagramParticipant[]> {
    return apiFetch<DiagramParticipant[]>(`/api/diagrams/${diagramId}/participants`);
}

export async function addDiagramParticipant(
    diagramId: number,
    user: ParticipantUserOption,
    role: AssignableRole,
): Promise<void> {
    await apiFetch(`/api/diagrams/${diagramId}/participants/${user.userId}`, {
        method: 'POST',
        body: JSON.stringify({ role }),
    });
}

export async function updateDiagramParticipantRole(
    diagramId: number,
    userId: number,
    role: string,
): Promise<void> {
    await apiFetch(`/api/diagrams/${diagramId}/participants/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
    });
}

export async function removeDiagramParticipant(
    diagramId: number,
    userId: number,
): Promise<void> {
    await apiFetch(`/api/diagrams/${diagramId}/participants/${userId}`, {
        method: 'DELETE',
    });
}
