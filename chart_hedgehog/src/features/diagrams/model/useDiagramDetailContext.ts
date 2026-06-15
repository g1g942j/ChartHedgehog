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
    });

    const diagramQuery = useQuery({
        queryKey: ['diagram', diagramId, currentUserQuery.data?.username],
        queryFn: () =>
            fetchDiagramDetail(
                diagramId,
                currentUserQuery.data?.username,
            ),
        enabled: currentUserQuery.isSuccess,
    });

    const loadError =
        diagramQuery.error instanceof Error
            ? diagramQuery.error.message
            : diagramQuery.error
              ? 'Ошибка загрузки'
              : null;

    useEffect(() => {
        if (loadError === 'Не авторизован') {
            router.replace('/');
        }
    }, [loadError, router]);

    return {
        diagram: diagramQuery.data ?? null,
        currentUser: currentUserQuery.data ?? null,
        isLoading: diagramQuery.isPending || currentUserQuery.isPending,
        loadError,
        refetchDiagram: diagramQuery.refetch,
    };
}
