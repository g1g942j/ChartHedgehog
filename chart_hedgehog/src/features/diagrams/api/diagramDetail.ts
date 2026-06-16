import { apiFetch } from '@/shared/api/client';

import { mapDiagramToDetail } from './mappers';
import type { ApiDiagram } from './types';

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
    const diagram = await apiFetch<ApiDiagram>(`/api/diagrams/${id}`);
    return mapDiagramToDetail(diagram, currentUsername);
}
 
export async function fetchDiagramEntity(id: number): Promise<ApiDiagram> {
    return apiFetch<ApiDiagram>(`/api/diagrams/${id}`);
}
// function storedToApiDiagram(
//     stored: NonNullable<ReturnType<typeof getDiagramById>>,
// ): ApiDiagram {
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

// export async function fetchDiagramDetail(
//     id: number,
//     currentUsername?: string,
// ): Promise<DiagramDetail> {
//     const stored = getDiagramById(id);
//     if (!stored) {
//         throw new Error('Диаграмма не найдена');
//     }

//     const diagram = storedToApiDiagram(stored);

//     if (currentUsername && !userHasAccess(diagram, currentUsername)) {
//         throw new Error('Нет доступа к диаграмме');
//     }

//     return mapDiagramToDetail(diagram, currentUsername);
// }

// export async function fetchDiagramEntity(id: number): Promise<ApiDiagram> {
//     const stored = getDiagramById(id);
//     if (!stored) {
//         throw new Error('Диаграмма не найдена');
//     }

//     return storedToApiDiagram(stored);
// }
