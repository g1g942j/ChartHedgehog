'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchCurrentUser } from '@/features/profile/api/profile';
import { useLocale } from '@/shared/i18n';

import {
    addDiagramParticipant,
    fetchDiagramParticipants,
    type ParticipantUserOption,
    removeDiagramParticipant,
    searchParticipantUsers,
    updateDiagramParticipantRole,
} from '../api/participants';
import type { AssignableRole } from '../constants/roles';

export function useDiagramParticipants(
    diagramId: number,
    canManage: boolean,
) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { t } = useLocale();

    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] =
        useState<ParticipantUserOption | null>(null);
    const [newRole, setNewRole] = useState<AssignableRole>('EDITOR');
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const currentUserQuery = useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
    });

    const participantsQuery = useQuery({
        queryKey: ['diagramParticipants', diagramId, currentUserQuery.data?.username],
        queryFn: () =>
            fetchDiagramParticipants(
                diagramId,
                currentUserQuery.data?.username,
            ),
        enabled: currentUserQuery.isSuccess,
    });

    const userOptionsQuery = useQuery({
        queryKey: ['participantUserSearch', diagramId, userSearchQuery],
        queryFn: () => searchParticipantUsers(userSearchQuery, diagramId),
        enabled: canManage && userSearchQuery.trim().length >= 2,
    });

    const loadError =
        participantsQuery.error instanceof Error
            ? participantsQuery.error.message
            : currentUserQuery.error instanceof Error
              ? currentUserQuery.error.message
              : null;

    useEffect(() => {
        if (loadError === 'Не авторизован') {
            router.replace('/');
        }
    }, [loadError, router]);

    const invalidate = async () => {
        await queryClient.invalidateQueries({
            queryKey: ['diagramParticipants', diagramId],
        });
        await queryClient.invalidateQueries({ queryKey: ['diagram', diagramId] });
        await queryClient.invalidateQueries({ queryKey: ['myDiagrams'] });
    };

    const handleAdd = async () => {
        if (!canManage) {
            return;
        }

        if (!selectedUser) {
            setAddError(t.participants.enterValidUserId);
            return;
        }

        setIsAdding(true);
        setAddError(null);
        setActionError(null);

        try {
            const exists = participantsQuery.data?.some(
                (participant) =>
                    participant.userId === selectedUser.userId,
            );
            if (exists) {
                throw new Error(t.participants.alreadyExists);
            }

            await addDiagramParticipant(diagramId, selectedUser, newRole);
            setSelectedUser(null);
            setUserSearchQuery('');
            await invalidate();
        } catch (error) {
            setAddError(
                error instanceof Error
                    ? error.message
                    : t.participants.addError,
            );
        } finally {
            setIsAdding(false);
        }
    };

    const handleRoleChange = async (userId: number, role: string, fromRole: string, displayName: string) => {
        if (!canManage) {
            return;
        }

        const isOwnerTransfer = role === 'OWNER';

        const fromLabel = t.roles[fromRole] ?? fromRole;
        const toLabel = t.roles[role] ?? role;

        const confirmMessage = isOwnerTransfer
            ? `Вы передаёте права владельца пользователю ${displayName}. Вы станете редактором и потеряете управление диаграммой. Продолжить?`
            : `Изменить роль ${displayName} с «${fromLabel}» на «${toLabel}»?`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setActionError(null);
        try {
            await updateDiagramParticipantRole(diagramId, userId, role);
            await invalidate();
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : t.participants.addError,
            );
        }
    };

    const handleRemove = async (userId: number, displayName: string) => {
        const confirmed = window.confirm(t.participants.removeConfirm(displayName));
        if (!confirmed) {
            return;
        }

        setActionError(null);
        try {
            await removeDiagramParticipant(diagramId, userId);
            await invalidate();
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : t.participants.removeError,
            );
        }
    };

    return {
        participants: participantsQuery.data ?? [],
        isLoading:
            participantsQuery.isPending || currentUserQuery.isPending,
        loadError,
        userSearchQuery,
        setUserSearchQuery,
        selectedUser,
        setSelectedUser,
        userOptions: userOptionsQuery.data ?? [],
        isSearchingUsers: userOptionsQuery.isFetching,
        newRole,
        setNewRole,
        isAdding,
        addError,
        actionError,
        handleAdd,
        handleRoleChange,
        handleRemove,
    };
}
