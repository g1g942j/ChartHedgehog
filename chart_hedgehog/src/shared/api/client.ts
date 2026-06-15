export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function parseError(response: Response): Promise<string> {
    try {
        const data = await response.json();
        if (data && typeof data.error === 'string') {
            return data.error;
        }
        if (data && typeof data.message === 'string') {
            return data.message;
        }
    } catch {
        // response body is not JSON
    }
    return `Request failed with status ${response.status}`;
}

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const message = await parseError(response);
        throw new ApiError(message, response.status);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}
