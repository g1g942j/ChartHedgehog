import { apiFetch } from '@/shared/api/client';

export type DiagramDetail = {
    id: number;
    name: string;
    description?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    ownerId: number;
    ownerUsername: string;
    currentUserRole: string;
    isPublic?: boolean;
};

export async function fetchDiagramDetail(id: number): Promise<DiagramDetail> {
    return apiFetch<DiagramDetail>(`/api/diagrams/${id}`);
}
