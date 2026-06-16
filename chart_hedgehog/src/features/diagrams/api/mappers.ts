import type { StoredDiagram } from '@/shared/auth/session';

import type { DiagramDetail } from './diagramDetail';
import type { DiagramSummary } from './diagrams';
import type { DiagramParticipant } from './participants';
import type { ApiDiagram } from './types';

// Единственный маппер StoredDiagram → ApiDiagram (используется в diagrams.ts и diagramDetail.ts)
export function toApiDiagram(stored: StoredDiagram): ApiDiagram {
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

export function resolveUserRole(
    diagram: ApiDiagram,
    currentUsername: string | undefined,
): string {
    if (!currentUsername || !diagram.owner) {
        return 'VIEWER';
    }

    if (diagram.owner.username === currentUsername) {
        return 'OWNER';
    }

    const link = diagram.participantRoles?.find(
        (entry) => entry.user?.username === currentUsername,
    );

    return link?.role ?? 'VIEWER';
}

// Проверяет наличие доступа по participantRoles (авторитетный источник ролей)
export function userHasAccess(
    diagram: ApiDiagram,
    currentUsername: string | undefined,
): boolean {
    if (!currentUsername) {
        return false;
    }

    if (diagram.owner?.username === currentUsername) {
        return true;
    }

    return (
        diagram.participantRoles?.some(
            (entry) => entry.user?.username === currentUsername,
        ) ?? false
    );
}

export function mapDiagramToDetail(
    diagram: ApiDiagram,
    currentUsername: string | undefined,
): DiagramDetail {
    return {
        id: diagram.id,
        name: diagram.name,
        description: diagram.description,
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
        ownerId: diagram.owner?.id ?? 0,
        ownerUsername: diagram.owner?.username ?? '',
        currentUserRole: resolveUserRole(diagram, currentUsername),
    };
}

export function mapDiagramToSummary(
    diagram: ApiDiagram,
    currentUsername: string | undefined,
): DiagramSummary {
    return {
        id: diagram.id,
        name: diagram.name,
        description: diagram.description,
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
        ownerUsername: diagram.owner?.username ?? '',
        role: resolveUserRole(diagram, currentUsername),
    };
}

export function buildParticipantsList(diagram: ApiDiagram): DiagramParticipant[] {
    const owner = diagram.owner;
    if (!owner) {
        return [];
    }

    const result: DiagramParticipant[] = [
        {
            userId: owner.id,
            username: owner.username,
            email: owner.email,
            fullName: owner.fullName,
            role: 'OWNER',
        },
    ];

    for (const link of diagram.participantRoles ?? []) {
        const user = link.user;
        if (user.id === owner.id) {
            continue;
        }

        result.push({
            userId: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: link.role,
        });
    }

    return result;
}
