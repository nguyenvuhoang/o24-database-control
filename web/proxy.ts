import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, validateSession } from './lib/session';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/api/ingest' || path === '/api/auth/login' || path === '/api/auth/logout' || path === '/login') {
    if (path === '/login' && validateSession(request.cookies.get(SESSION_COOKIE)?.value)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }
  if (validateSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', request.url));
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
