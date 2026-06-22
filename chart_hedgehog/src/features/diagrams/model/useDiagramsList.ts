'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchCurrentUser } from '@/features/profile/api/profile';
import { useLocale } from '@/shared/i18n';
import { useToast } from '@/shared/toast';

import { buildPreviewSvg, fetchDiagramEditorState } from '../api/diagramEditor';
import { cloneDiagram, createDiagram, fetchMyDiagrams } from '../api/diagrams';

export function useDiagramsList() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { t } = useLocale();
    const toast = useToast();
    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [cloningId, setCloningId] = useState<number | null>(null);
    const [generatedPreviews, setGeneratedPreviews] = useState<Record<number, string>>({});

    const currentUserQuery = useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
    });

    const {
        data: diagrams = [],
        error,
        isPending: isLoading,
    } = useQuery({
        queryKey: ['myDiagrams'],
        queryFn: fetchMyDiagrams,
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

    useEffect(() => {
        const withoutPreview = diagrams.filter((d) => !d.preview);
        if (withoutPreview.length === 0) return;
        let cancelled = false;
        void Promise.all(
            withoutPreview.map(async (d) => {
                try {
                    const state = await fetchDiagramEditorState(d.id);
                    const svg = buildPreviewSvg(state.blocks);
                    return svg ? ([d.id, svg] as const) : null;
                } catch {
                    return null;
                }
            }),
        ).then((results) => {
            if (cancelled) return;
            const map: Record<number, string> = {};
            for (const r of results) {
                if (r) map[r[0]] = r[1];
            }
            if (Object.keys(map).length > 0) {
                setGeneratedPreviews((prev) => ({ ...prev, ...map }));
            }
        });
        return () => { cancelled = true; };
    }, [diagrams]);

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) {
            toast.error(t.diagrams.enterDiagramName);
            return;
        }

        setIsCreating(true);
        try {
            await createDiagram(name);
            setNewName('');
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
            toast.success(t.diagrams.created);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t.diagrams.createError);
        } finally {
            setIsCreating(false);
        }
    };

    const handleClone = async (id: number) => {
        setCloningId(id);
        try {
            await cloneDiagram(id);
            await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
            toast.success(t.diagrams.cloned);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t.diagrams.cloneError);
        } finally {
            setCloningId(null);
        }
    };

    return {
        diagrams,
        isLoading: isLoading || currentUserQuery.isPending,
        loadError,
        newName,
        setNewName,
        isCreating,
        handleCreate,
        cloningId,
        handleClone,
        generatedPreviews,
    };
}
