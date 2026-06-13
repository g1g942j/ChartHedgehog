'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    changeCurrentUserPassword,
    deactivateCurrentUser,
    fetchCurrentUser,
    updateCurrentUser,
    type ChangePasswordPayload,
    type UpdateProfilePayload,
} from '../api/profile';

export function useProfilePage() {
    const queryClient = useQueryClient();
    const { data: userMeta, error: loadError, isPending: isLoadingProfile } =
        useQuery({
            queryKey: ['currentUser'],
            queryFn: fetchCurrentUser,
        });

    const updateProfileMutation = useMutation({
        mutationFn: (payload: UpdateProfilePayload) => updateCurrentUser(payload),
        onSuccess: (user) => {
            queryClient.setQueryData(['currentUser'], user);
        },
    });

    const changePasswordMutation = useMutation({
        mutationFn: (payload: ChangePasswordPayload) =>
            changeCurrentUserPassword(payload),
    });

    const deactivateAccountMutation = useMutation({
        mutationFn: deactivateCurrentUser,
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['currentUser'] });
        },
    });

    return {
        userMeta: userMeta ?? null,
        loadError:
            loadError instanceof Error
                ? loadError.message
                : loadError
                  ? 'Ошибка загрузки'
                  : null,
        isLoadingProfile,
        updateProfile: updateProfileMutation.mutateAsync,
        updateProfileError:
            updateProfileMutation.error instanceof Error
                ? updateProfileMutation.error.message
                : null,
        isUpdatingProfile: updateProfileMutation.isPending,
        resetUpdateProfile: updateProfileMutation.reset,
        changePassword: changePasswordMutation.mutateAsync,
        changePasswordError:
            changePasswordMutation.error instanceof Error
                ? changePasswordMutation.error.message
                : null,
        isChangingPassword: changePasswordMutation.isPending,
        resetChangePassword: changePasswordMutation.reset,
        deactivateAccount: deactivateAccountMutation.mutateAsync,
        deactivateAccountError:
            deactivateAccountMutation.error instanceof Error
                ? deactivateAccountMutation.error.message
                : null,
        isDeactivatingAccount: deactivateAccountMutation.isPending,
    };
}
