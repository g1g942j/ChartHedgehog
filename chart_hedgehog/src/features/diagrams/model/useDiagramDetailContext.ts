'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useQuery } from '@tanstack/react-query';

import { fetchCurrentUser } from '@/features/profile/api/profile';

import { fetchDiagramDetail } from '../api/diagramDetail';

export function useDiagramDetailContext(diagramId: number) {
    const router = useRouter();

    const currentUserQuery = useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
        retry: false,
    });

    const diagramQuery = useQuery({
        queryKey: ['diagram', diagramId],
        queryFn: () => fetchDiagramDetail(diagramId),
    });

    // Only propagate currentUser error if diagram also failed — public diagrams
    // load without auth, so a 401 on /me should not block the editor.
    // Propagate currentUser error only after diagramQuery has finished —
    // otherwise a fast 401 on /me redirects before the public diagram loads.
    const loadError =
        diagramQuery.error instanceof Error
            ? diagramQuery.error.message
            : !diagramQuery.isPending && !diagramQuery.data && currentUserQuery.error instanceof Error
              ? currentUserQuery.error.message
              : null;

    useEffect(() => {
        if (loadError === 'Не авторизован') {
            router.replace('/');
        }
    }, [loadError, router]);

    return {
        diagram: diagramQuery.data ?? null,
        currentUser: currentUserQuery.data ?? null,
        isLoading: diagramQuery.isPending,
        loadError,
        refetchDiagram: diagramQuery.refetch,
    };
}
