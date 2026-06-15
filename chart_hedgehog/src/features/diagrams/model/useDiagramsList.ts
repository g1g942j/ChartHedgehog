'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchCurrentUser } from '@/features/profile/api/profile';
import { useLocale } from '@/shared/i18n';

import { createDiagram, fetchMyDiagrams } from '../api/diagrams';

export function useDiagramsList() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { t } = useLocale();
    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const currentUserQuery = useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
    });

    const {
        data: diagrams = [],
        error,
        isPending: isLoading,
    } = useQuery({
        queryKey: ['myDiagrams', currentUserQuery.data?.username],
        queryFn: () =>
            fetchMyDiagrams(currentUserQuery.data?.username),
        enabled: currentUserQuery.isSuccess,
    });

    const loadError =
        error instanceof Error
            ? error.message
            : currentUserQuery.error instanceof Error
              ? currentUserQuery.error.message
              : error || currentUserQuery.error
                ? t.diagrams.loadError
                : null;

    useEffect(() => {
        if (loadError === 'Не авторизован') {
            router.replace('/');
        }
    }, [loadError, router]);

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) {
            setCreateError(t.diagrams.enterDiagramName);
            return;
        }

        setIsCreating(true);
        setCreateError(null);

        try {
            await createDiagram(name);
            setNewName('');
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
        } catch (err) {
            setCreateError(
                err instanceof Error ? err.message : t.diagrams.createError,
            );
        } finally {
            setIsCreating(false);
        }
    };

    return {
        diagrams,
        isLoading: isLoading || currentUserQuery.isPending,
        loadError,
        newName,
        setNewName,
        isCreating,
        createError,
        handleCreate,
    };
}
