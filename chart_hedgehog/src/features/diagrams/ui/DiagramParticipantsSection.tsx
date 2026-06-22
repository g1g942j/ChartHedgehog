'use client';

import { useMemo } from 'react';

import Autocomplete from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';

import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { Typography } from '@/shared/ui/Typography';

import styles from './DiagramParticipantsSection.module.scss';

import type { AssignableRole } from '../constants/roles';
import { ASSIGNABLE_ROLES, OWNER_ASSIGNABLE_ROLES, roleLabel } from '../constants/roles';
import { useDiagramParticipants } from '../model/useDiagramParticipants';

type DiagramParticipantsSectionProps = {
    diagramId: number;
    canManage: boolean;
    currentUsername?: string;
    isOwner?: boolean;
};

export function DiagramParticipantsSection(props: DiagramParticipantsSectionProps) {
    const { diagramId, canManage, currentUsername, isOwner: currentUserIsOwner = false } = props;
    const { t } = useLocale();

    const roleOptions = useMemo<SelectOption<AssignableRole>[]>(
        () =>
            ASSIGNABLE_ROLES.map((role) => ({
                value: role,
                label: roleLabel(role, t.roles),
            })),
        [t.roles],
    );

    const ownerRoleOptions = useMemo<SelectOption<string>[]>(
        () =>
            OWNER_ASSIGNABLE_ROLES.map((role) => ({
                value: role,
                label: roleLabel(role, t.roles),
            })),
        [t.roles],
    );

    const {
        participants,
        isLoading,
        loadError,
        userSearchQuery,
        setUserSearchQuery,
        selectedUser,
        setSelectedUser,
        userOptions,
        isSearchingUsers,
        newRole,
        setNewRole,
        isAdding,
        addError,
        actionError,
        handleAdd,
        handleRoleChange,
        handleRemove,
        confirmModal,
    } = useDiagramParticipants(diagramId, canManage);

    if (isLoading) {
        return <Typography color="text.secondary">{t.common.loading}</Typography>;
    }

    if (loadError) {
        return <Alert severity="error">{loadError}</Alert>;
    }

    return (
        <section className={styles.Section}>
            <ConfirmModal {...confirmModal} dangerous />
            {actionError ? <Alert severity="error">{actionError}</Alert> : null}

            {canManage ? (
                <div className={styles.Card}>
                    <Typography variant="subtitle1">
                        {t.participants.addTitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t.participants.addDescription}
                    </Typography>
                    {addError ? <Alert severity="error">{addError}</Alert> : null}
                    <div className={styles.AddRow}>
                        <Autocomplete
                            filterOptions={(x) => x}
                            value={selectedUser}
                            inputValue={userSearchQuery}
                            options={userOptions}
                            loading={isSearchingUsers}
                            onChange={(_, option) => setSelectedUser(option)}
                            onInputChange={(_, value) => {
                                setUserSearchQuery(value);
                                if (!value) {
                                    setSelectedUser(null);
                                }
                            }}
                            getOptionLabel={(option) =>
                                option.fullName ||
                                `${option.username} (${option.email})`
                            }
                            isOptionEqualToValue={(option, value) =>
                                option.userId === value.userId
                            }
                            renderInput={(params) => (
                                <MuiTextField
                                    {...params}
                                    label={t.participants.userIdentifier}
                                />
                            )}
                            renderOption={(props, option) => (
                                <li {...props} key={option.userId}>
                                    <div>
                                        <Typography variant="subtitle2">
                                            {option.fullName || option.username}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {option.email} · @{option.username}
                                        </Typography>
                                    </div>
                                </li>
                            )}
                        />
                        <Select<AssignableRole>
                            label={t.participants.role}
                            value={newRole}
                            onChange={setNewRole}
                            options={roleOptions}
                        />
                        <Button
                            variant="contained"
                            loading={isAdding}
                            disabled={!selectedUser}
                            onClick={() => void handleAdd()}
                        >
                            {t.participants.add}
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className={styles.Card}>
                <Typography variant="subtitle1">
                    {t.participants.title(participants.length)}
                </Typography>
                {participants.length === 0 ? (
                    <Typography color="text.secondary">
                        {t.participants.empty}
                    </Typography>
                ) : (
                    <ul className={styles.List}>
                        {participants.map((participant) => {
                            const isOwner = participant.role === 'OWNER';
                            const isSelf =
                                currentUsername !== undefined &&
                                participant.username === currentUsername;
                            const displayName =
                                participant.fullName ||
                                participant.username;
                            const canRemoveRow =
                                (canManage && !isOwner) ||
                                (isSelf && !isOwner);
                            // Only the diagram owner can change roles (enforced by
                            // the backend) — everyone else sees a static badge.
                            const canEditRole = currentUserIsOwner && !isOwner;

                            return (
                                <li
                                    key={participant.userId}
                                    className={styles.Item}
                                >
                                    <div className={styles.ItemMain}>
                                        <div>
                                            <Typography variant="subtitle2">
                                                {displayName}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {participant.email} · @
                                                {participant.username}
                                            </Typography>
                                        </div>
                                        {canEditRole ? (
                                            <Select<string>
                                                value={participant.role}
                                                onChange={(role) =>
                                                    void handleRoleChange(
                                                        participant.userId,
                                                        role,
                                                        participant.role,
                                                        displayName,
                                                    )
                                                }
                                                options={ownerRoleOptions}
                                                className={styles.RoleSelect}
                                            />
                                        ) : (
                                            <span className={styles.RoleBadge}>
                                                {roleLabel(
                                                    participant.role,
                                                    t.roles,
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {canRemoveRow ? (
                                        <Button
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                            onClick={() =>
                                                void handleRemove(
                                                    participant.userId,
                                                    displayName,
                                                )
                                            }
                                        >
                                            {t.participants.remove}
                                        </Button>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
