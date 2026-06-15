export type ApiUser = {
    id: number;
    username: string;
    email: string;
    fullName?: string | null;
};

export type ApiDiagramParticipantLink = {
    user: ApiUser;
    role: string;
};

export type ApiDiagram = {
    id: number;
    name: string;
    description?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    template?: string | null;
    content?: string | null;
    owner: ApiUser;
    participants?: ApiUser[];
    participantRoles?: ApiDiagramParticipantLink[];
};
