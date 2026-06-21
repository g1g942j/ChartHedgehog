import { type NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'ch_auth';

export function middleware(request: NextRequest): NextResponse {
    if (!request.cookies.has(AUTH_COOKIE)) {
        const loginUrl = new URL('/', request.url);
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
}

export const config = {
    // /diagrams (list) and /profile require auth cookie.
    // /diagrams/[id] and sub-routes are intentionally excluded —
    // public diagrams are accessible without auth; React components
    // handle their own redirect when access is denied.
    matcher: ['/diagrams', '/profile'],
};
