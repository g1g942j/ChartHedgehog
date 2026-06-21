import { apiFetch } from '@/shared/api/client';

export type DiagramSummary = {
    id: number;
    name: string;
    description?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    ownerUsername: string;
    role: string;
    preview?: string | null;
};

export async function fetchMyDiagrams(): Promise<DiagramSummary[]> {
    return apiFetch<DiagramSummary[]>('/api/diagrams/my');
}

export async function createDiagram(name: string): Promise<DiagramSummary> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Введите название диаграммы');
    return apiFetch<DiagramSummary>('/api/diagrams', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed }),
    });
}

export async function updateDiagramName(
    id: number,
    name: string,
): Promise<DiagramSummary> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Введите название диаграммы');
    return apiFetch<DiagramSummary>(`/api/diagrams/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
    });
}

export async function deleteDiagram(id: number): Promise<void> {
    await apiFetch(`/api/diagrams/${id}`, { method: 'DELETE' });
}

export async function cloneDiagram(id: number): Promise<DiagramSummary> {
    return apiFetch<DiagramSummary>(`/api/diagrams/${id}/clone`, {
        method: 'POST',
    });
}
