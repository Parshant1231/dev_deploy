import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// EDGE MIDDLEWARE
//
// Runs before any page renders. Checks for the JWT
// cookie and redirects accordingly. This prevents
// the flash of protected content before client-side
// auth checks complete — the redirect happens at the
// edge, before any React code runs.
// ─────────────────────────────────────────────

const PROTECTED_PATHS = ['/dashboard', '/settings'];
const AUTH_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('devdeploy_token')?.value;
  const { pathname } = request.nextUrl;

  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));

  // No token, trying to access protected route → redirect to login
  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Has token, trying to access login/register → redirect to dashboard
  if (isAuthPath && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/login', '/register'],
};