export type SessionUser = {
    id: number;
    username: string;
    email: string;
    role: string;
    fullName?: string | null;
};

const SESSION_KEY = 'chart_hedgehog_session';
const DIAGRAMS_KEY = 'chart_hedgehog_diagrams';

export type StoredDiagram = {
    id: number;
    name: string;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
    template?: string | null;
    content?: string | null;
    preview?: string | null;
    ownerUsername: string;
    ownerId: number;
    participantRoles: Array<{
        userId: number;
        username: string;
        email: string;
        fullName?: string | null;
        role: string;
    }>;
};

function readJson<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
        return fallback;
    }
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            return fallback;
        }
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function writeJson<T>(key: string, value: T): void {
    window.localStorage.setItem(key, JSON.stringify(value));
}

export function getSessionUser(): SessionUser | null {
    return readJson<SessionUser | null>(SESSION_KEY, null);
}

export function setSessionUser(user: SessionUser): void {
    writeJson(SESSION_KEY, user);
}

export function clearSession(): void {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(DIAGRAMS_KEY);
}

export function getStoredDiagrams(): StoredDiagram[] {
    return readJson<StoredDiagram[]>(DIAGRAMS_KEY, []);
}

export function saveStoredDiagrams(diagrams: StoredDiagram[]): void {
    writeJson(DIAGRAMS_KEY, diagrams);
}

export function nextDiagramId(diagrams: StoredDiagram[]): number {
    if (diagrams.length === 0) {
        return 1;
    }
    return Math.max(...diagrams.map((d) => d.id)) + 1;
}
