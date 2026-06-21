import { type NextRequest, NextResponse } from 'next/server';

// JSESSIONID is set by Spring Security (httpOnly — unreadable by XSS).
// Since both the frontend (port 3000) and backend (port 8080) share the
// same host, cookies are domain-scoped and JSESSIONID is visible here.
const AUTH_COOKIE = 'JSESSIONID';

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
