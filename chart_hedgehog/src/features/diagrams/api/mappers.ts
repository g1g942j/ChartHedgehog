import type { DiagramDetail } from './diagramDetail';
import type { DiagramSummary } from './diagrams';
import type { DiagramParticipant } from './participants';
import type { ApiDiagram } from './types';

export function resolveUserRole(
    diagram: ApiDiagram,
    currentUsername: string | undefined,
): string {
    if (!currentUsername) {
        return 'VIEWER';
    }

    if (!diagram.owner) {
        return 'VIEWER';
    }

    if (diagram.owner.username === currentUsername) {
        return 'OWNER';
    }

    const link = diagram.participantRoles?.find(
        (entry) => entry.user?.username === currentUsername,
    );

    if (link) {
        return link.role;
    }

    const isParticipant = diagram.participants?.some(
        (user) => user.username === currentUsername,
    );

    return isParticipant ? 'VIEWER' : 'VIEWER';
}

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
        diagram.participants?.some((user) => user.username === currentUsername) ??
        false
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
