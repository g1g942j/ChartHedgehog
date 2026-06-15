export const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
    OWNER: 'Владелец',
    EDITOR: 'Редактор',
    COMMENTATOR: 'Комментатор',
    VIEWER: 'Зритель',
};

export const ASSIGNABLE_ROLES = ['EDITOR', 'COMMENTATOR', 'VIEWER'] as const;
export const OWNER_ASSIGNABLE_ROLES = ['OWNER', 'EDITOR', 'COMMENTATOR', 'VIEWER'] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export type OwnerAssignableRole = (typeof OWNER_ASSIGNABLE_ROLES)[number];

export function roleLabel(
    role: string,
    labels: Record<string, string> = PARTICIPANT_ROLE_LABELS,
): string {
    return labels[role] ?? role;
}

export function canManageParticipants(role: string): boolean {
    return role === 'OWNER' || role === 'EDITOR';
}
